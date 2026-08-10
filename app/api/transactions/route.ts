import { NextResponse } from "next/server"
import { z } from "zod"

import { dbConnect } from "@/lib/db"
import { getAuthPayload } from "@/lib/request-auth"
import { Transaction } from "@/models/Transaction"
import { User } from "@/models/User"
import { isCreditCategory } from "@/utils/categories"

export const runtime = "nodejs"

const CreateTransactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.number().positive(),
  category: z.string().default("Other"),
  merchant: z.string().max(80).optional().default(""),
  note: z.string().max(240).optional().default(""),
  occurredAt: z.string().datetime().optional(),
})

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

  const txns = await Transaction.find(filter).sort({ occurredAt: -1 }).limit(100).lean()

  return NextResponse.json({
    transactions: txns.map((t) => ({
      id: t._id.toString(),
      type: t.type,
      amount: t.amount,
      category: t.category,
      merchant: t.merchant,
      note: t.note,
      occurredAt: t.occurredAt,
      createdAt: t.createdAt,
    })),
  })
}

export async function POST(req: Request) {
  const auth = getAuthPayload(req)
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = CreateTransactionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid transaction", issues: parsed.error.flatten() }, { status: 400 })
  }

  await dbConnect()
  const created = await Transaction.create({
    userId: auth.sub,
    type: parsed.data.type,
    amount: parsed.data.amount,
    category: parsed.data.category,
    merchant: parsed.data.merchant,
    note: parsed.data.note,
    occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date(),
  })

  // Synchronize user balance state
  const balanceField = isCreditCategory(parsed.data.category) ? "creditBalance" : "cashBalance"
  const balanceDelta = parsed.data.type === "income" ? parsed.data.amount : -parsed.data.amount

  await User.findByIdAndUpdate(auth.sub, { $inc: { [balanceField]: balanceDelta } })

  return NextResponse.json({
    transaction: {
      id: created._id.toString(),
      type: created.type,
      amount: created.amount,
      category: created.category,
      merchant: created.merchant,
      note: created.note,
      occurredAt: created.occurredAt,
      createdAt: created.createdAt,
    },
  })
}
