import { NextResponse } from "next/server"

import { dbConnect } from "@/lib/db"
import { getAuthPayload } from "@/lib/request-auth"
import { Transaction } from "@/models/Transaction"

export const runtime = "nodejs"

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '""'
  const str = String(val).replace(/"/g, '""')
  return `"${str}"`
}

export async function GET(req: Request) {
  const auth = getAuthPayload(req)
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const from = url.searchParams.get("from")
  const to = url.searchParams.get("to")

  await dbConnect()

  const filter: Record<string, unknown> = { userId: auth.sub }
  if (from || to) {
    filter.occurredAt = {
      ...(from ? { $gte: new Date(from) } : {}),
      ...(to ? { $lte: new Date(to) } : {}),
    }
  }

  const txns = await Transaction.find(filter).sort({ occurredAt: -1 }).limit(1000).lean()

  const headers = ["ID", "Date", "Type", "Category", "Merchant", "Amount", "Note"]
  const rows = txns.map((t) => [
    escapeCsvField(t._id.toString()),
    escapeCsvField(t.occurredAt ? new Date(t.occurredAt).toISOString().split("T")[0] : ""),
    escapeCsvField(t.type),
    escapeCsvField(t.category),
    escapeCsvField(t.merchant || ""),
    escapeCsvField(t.amount),
    escapeCsvField(t.note || ""),
  ])

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="finsight_transactions_${new Date().toISOString().split("T")[0]}.csv"`,
    },
  })
}
