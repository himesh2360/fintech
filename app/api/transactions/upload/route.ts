import { NextResponse } from "next/server"

import { dbConnect } from "@/lib/db"
import { getAuthPayload } from "@/lib/request-auth"
import { extractStatementText } from "@/lib/statement-extract"
import { parseBankStatementText, toOccurredAt, type ParsedStatementTxn } from "@/lib/statement-parser"
import { Transaction } from "@/models/Transaction"
import { User } from "@/models/User"

export const runtime = "nodejs"

async function insertParsedTransactions(userId: string, txnsToInsert: ParsedStatementTxn[]) {
  await dbConnect()

  const existingTxns = await Transaction.find({ userId }).select("occurredAt type amount merchant").lean()

  const existingKeys = new Set(
    existingTxns.map(
      (e) =>
        `${new Date(e.occurredAt).toISOString().slice(0, 10)}_${e.type}_${Number(e.amount).toFixed(2)}_${(
          e.merchant || ""
        )
          .toLowerCase()
          .trim()}`
    )
  )

  const uniqueToInsert: ParsedStatementTxn[] = []
  let duplicatesCount = 0

  for (const t of txnsToInsert) {
    const dStr = (t.date || new Date().toISOString()).slice(0, 10)
    const mStr = (t.merchant || "").toLowerCase().trim()
    const key = `${dStr}_${t.type || "expense"}_${Number(t.amount || 0).toFixed(2)}_${mStr}`

    if (existingKeys.has(key)) {
      duplicatesCount++
    } else {
      existingKeys.add(key)
      uniqueToInsert.push(t)
    }
  }

  if (uniqueToInsert.length === 0) {
    return {
      success: true,
      count: 0,
      totalParsed: txnsToInsert.length,
      duplicatesSkipped: duplicatesCount,
      message: `All ${txnsToInsert.length} transactions already exist in your activity ledger (0 duplicates imported).`,
      transactions: [] as unknown[],
      netBalanceImpact: 0,
    }
  }

  const formatted = uniqueToInsert.map((t) => ({
    userId,
    occurredAt: t.date ? toOccurredAt(t.date.slice(0, 10)) : new Date(),
    type: t.type || "expense",
    amount: Math.abs(Number(t.amount || 0)),
    category: t.category || "Other",
    merchant: t.merchant || "Statement Import",
    note: t.note || "Bulk imported statement transaction",
  }))

  const inserted = await Transaction.insertMany(formatted)

  let netDelta = 0
  for (const t of formatted) {
    if (t.type === "expense") netDelta -= t.amount
    else netDelta += t.amount
  }

  await User.findByIdAndUpdate(userId, {
    $inc: { cashBalance: netDelta },
  })

  return {
    success: true,
    count: inserted.length,
    totalParsed: txnsToInsert.length,
    duplicatesSkipped: duplicatesCount,
    netBalanceImpact: netDelta,
    transactions: inserted,
  }
}

async function resolveTransactionsFromRequest(req: Request): Promise<{
  txns: ParsedStatementTxn[]
  previewOnly: boolean
  sourceKind?: string
  extractedText?: string
  filename?: string
}> {
  const contentType = req.headers.get("content-type") || ""

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData()
    const previewOnly = String(form.get("preview") || "") === "true" || String(form.get("mode") || "") === "preview"
    const file = form.get("file")

    if (file && typeof file === "object" && "arrayBuffer" in file) {
      const f = file as File
      const buffer = Buffer.from(await f.arrayBuffer())
      const { kind, text } = await extractStatementText({
        buffer,
        filename: f.name || "statement",
        mime: f.type,
      })
      const txns = parseBankStatementText(text)
      return {
        txns,
        previewOnly,
        sourceKind: kind,
        extractedText: text,
        filename: f.name,
      }
    }

    const pasted = String(form.get("csvContent") || form.get("text") || "")
    return { txns: parseBankStatementText(pasted), previewOnly, sourceKind: "txt" }
  }

  const body = await req.json().catch(() => ({}))
  const previewOnly = body?.preview === true || body?.mode === "preview"

  if (Array.isArray(body?.transactions) && body.transactions.length > 0) {
    const txns: ParsedStatementTxn[] = (body.transactions as ParsedStatementTxn[]).map((t) => ({
      date: (t.date || new Date().toISOString()).slice(0, 10),
      type: (t.type === "income" ? "income" : "expense") as "income" | "expense",
      amount: Math.abs(Number(t.amount || 0)),
      category: t.category || "Other",
      merchant: t.merchant || "Statement Import",
      note: t.note,
    }))
    return { txns, previewOnly }
  }

  if (typeof body?.fileBase64 === "string" && body.fileBase64.trim()) {
    const buffer = Buffer.from(body.fileBase64.replace(/^data:[^;]+;base64,/, ""), "base64")
    const { kind, text } = await extractStatementText({
      buffer,
      filename: String(body.filename || "statement.pdf"),
      mime: body.mime,
    })
    return {
      txns: parseBankStatementText(text),
      previewOnly,
      sourceKind: kind,
      extractedText: text,
      filename: body.filename,
    }
  }

  if (typeof body?.csvContent === "string" && body.csvContent.trim()) {
    return { txns: parseBankStatementText(body.csvContent), previewOnly, sourceKind: "txt" }
  }

  return { txns: [], previewOnly }
}

export async function POST(req: Request) {
  const auth = getAuthPayload(req)
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const resolved = await resolveTransactionsFromRequest(req)

    if (resolved.txns.length === 0) {
      return NextResponse.json(
        {
          error: "No valid transactions found in statement data",
          sourceKind: resolved.sourceKind,
          filename: resolved.filename,
        },
        { status: 400 }
      )
    }

    if (resolved.previewOnly) {
      return NextResponse.json({
        success: true,
        preview: true,
        count: resolved.txns.length,
        sourceKind: resolved.sourceKind,
        filename: resolved.filename,
        transactions: resolved.txns.map((t) => ({
          date: String(t.date).slice(0, 10),
          type: t.type,
          amount: t.amount,
          category: t.category,
          merchant: t.merchant,
          note: t.note,
        })),
      })
    }

    const result = await insertParsedTransactions(auth.sub, resolved.txns)
    return NextResponse.json({
      ...result,
      sourceKind: resolved.sourceKind,
      filename: resolved.filename,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process bank statement"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
