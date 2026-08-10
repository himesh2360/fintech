import { NextResponse } from "next/server"

import { dbConnect } from "@/lib/db"
import { getAuthPayload } from "@/lib/request-auth"
import { Transaction } from "@/models/Transaction"
import { User } from "@/models/User"

export const runtime = "nodejs"

type RawTxnInput = {
  date?: string
  type?: "income" | "expense"
  amount: number
  category?: string
  merchant?: string
  note?: string
}

function parseCategoryFromDesc(desc: string, isIncome: boolean): string {
  if (isIncome) return "Income"
  const d = desc.toLowerCase()
  if (/swiggy|zomato|starbucks|food|dining|restaurant|pizza|cafe|instamart|blinkit|dhaba|cafeteria/i.test(d)) return "Food & Dining"
  if (/rent|electricity|wifi|jiofiber|airtel|bill|utility|bses|uppcl|broadband|hostel/i.test(d)) return "Utilities & Rent"
  if (/amazon|flipkart|ajio|croma|decathlon|myntra|dmart|shopping|nykaa|hardware|stationery/i.test(d)) return "Shopping"
  if (/netflix|spotify|bookmyshow|pvr|movie|entertainment/i.test(d)) return "Entertainment & Hobbies"
  if (/ola|uber|rapido|irctc|petrol|fuel|transport|pmpml/i.test(d)) return "Transport"
  if (/sip|mutual fund|axis bluechip|invest/i.test(d)) return "Investments"
  if (/emi|credit card|hdfc cc|loan|lic premium|tuition fee|college/i.test(d)) return "EMI"
  return "Other"
}

function parseUniversalBankLine(line: string): RawTxnInput | null {
  const trimmed = line.trim()
  const dateMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\s+/)
  if (!dateMatch) return null

  const rawDate = dateMatch[1]
  const rest = trimmed.slice(dateMatch[0].length).trim()
  const tokens = rest.split(/\s+/)
  if (tokens.length < 3) return null

  const balanceStr = tokens[tokens.length - 1].replace(/,/g, "")
  if (isNaN(parseFloat(balanceStr))) return null

  let amount = 0
  let isDeposit = false
  let descTokensEnd = tokens.length - 1

  const tLast2 = tokens[tokens.length - 2]?.replace(/,/g, "")
  const tLast3 = tokens[tokens.length - 3]?.replace(/,/g, "")

  const num2 = parseFloat(tLast2)
  const num3 = parseFloat(tLast3)

  if (!isNaN(num2) && !isNaN(num3)) {
    if (num2 > 0) {
      amount = num2
      isDeposit = true
    } else if (num3 > 0) {
      amount = num3
      isDeposit = false
    }
    descTokensEnd = tokens.length - 3
  } else if (!isNaN(num2) && num2 > 0) {
    amount = num2
    isDeposit = /NEFT CR|CREDIT|DEPOSIT|SALARY|ALLOWANCE|CASHBACK|VENDOR SETTLEMENT/i.test(trimmed)
    descTokensEnd = tokens.length - 2
  }

  if (amount <= 0) return null

  let desc = tokens.slice(0, descTokensEnd).join(" ")
  desc = desc.replace(/\s+[A-Z0-9]{8,15}$/i, "") // trim Ref/Cheque number

  const category = parseCategoryFromDesc(desc, isDeposit)
  const merchant = desc.replace(/^(UPI-|POS-|NEFT CR-|ATM WDL-|ATM CASH WDL )/i, "").trim()

  return {
    date: new Date(rawDate).toISOString(),
    type: isDeposit ? "income" : "expense",
    amount,
    category,
    merchant: merchant || "Statement Merchant",
    note: desc,
  }
}

function parseBankStatementText(content: string): RawTxnInput[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0)
  const txns: RawTxnInput[] = []

  for (const line of lines) {
    const parsedLine = parseUniversalBankLine(line)
    if (parsedLine) {
      txns.push(parsedLine)
      continue
    }

    // CSV Split Fallback
    const parts = line.trim().split(/,|\t/).map((p) => p.trim().replace(/^["']|["']$/g, ""))
    if (parts.length >= 2) {
      let amount = 0
      let merchant = ""
      let dateStr = new Date().toISOString()
      const isIncome = /credited|salary|refund|deposit|income/i.test(line)
      const txnType: "expense" | "income" = isIncome ? "income" : "expense"

      for (const p of parts) {
        const num = parseFloat(p.replace(/[^\d.-]/g, ""))
        if (!isNaN(num) && num !== 0 && amount === 0) {
          amount = Math.abs(num)
        } else if (/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/.test(p)) {
          dateStr = new Date(p).toISOString()
        } else if (p.length > 2 && !merchant) {
          merchant = p
        }
      }

      if (amount > 0) {
        txns.push({
          date: dateStr,
          type: txnType,
          amount,
          category: parseCategoryFromDesc(merchant || line, isIncome),
          merchant: merchant || "CSV Import",
          note: line.slice(0, 80),
        })
      }
    }
  }

  return txns
}

export async function POST(req: Request) {
  const auth = getAuthPayload(req)
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { csvContent, transactions: rawTxnsArray } = body

  let txnsToInsert: RawTxnInput[] = []

  if (Array.isArray(rawTxnsArray) && rawTxnsArray.length > 0) {
    txnsToInsert = rawTxnsArray
  } else if (typeof csvContent === "string" && csvContent.trim()) {
    txnsToInsert = parseBankStatementText(csvContent)
  }

  if (txnsToInsert.length === 0) {
    return NextResponse.json({ error: "No valid transactions found in statement data" }, { status: 400 })
  }

  await dbConnect()

  const existingTxns = await Transaction.find({ userId: auth.sub }).select("occurredAt type amount merchant").lean()

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

  const uniqueToInsert: RawTxnInput[] = []
  let duplicatesCount = 0

  for (const t of txnsToInsert) {
    const dStr = (t.date ? new Date(t.date) : new Date()).toISOString().slice(0, 10)
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
    return NextResponse.json({
      success: true,
      count: 0,
      totalParsed: txnsToInsert.length,
      duplicatesSkipped: duplicatesCount,
      message: `All ${txnsToInsert.length} transactions already exist in your activity ledger (0 duplicates imported).`,
      transactions: [],
    })
  }

  const formatted = uniqueToInsert.map((t) => ({
    userId: auth.sub,
    occurredAt: t.date ? new Date(t.date) : new Date(),
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

  await User.findByIdAndUpdate(auth.sub, {
    $inc: { cashBalance: netDelta },
  })

  return NextResponse.json({
    success: true,
    count: inserted.length,
    totalParsed: txnsToInsert.length,
    duplicatesSkipped: duplicatesCount,
    netBalanceImpact: netDelta,
    transactions: inserted,
  })
}
