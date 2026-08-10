import { NextResponse } from "next/server"
import { z } from "zod"

import { dbConnect } from "@/lib/db"
import { getAuthPayload } from "@/lib/request-auth"
import { Transaction, TransactionCategories } from "@/models/Transaction"
import { User } from "@/models/User"
import { isCreditCategory } from "@/utils/categories"

export const runtime = "nodejs"

const UpdateSchema = z.object({
  amount: z.number().positive().optional(),
  category: z.enum(TransactionCategories).optional(),
  merchant: z.string().max(80).optional(),
  note: z.string().max(240).optional(),
  occurredAt: z.string().datetime().optional(),
})

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = getAuthPayload(req)
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await ctx.params
  const body = await req.json().catch(() => null)
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update", issues: parsed.error.flatten() }, { status: 400 })
  }

  await dbConnect()
  const updated = await Transaction.findOneAndUpdate(
    { _id: id, userId: auth.sub },
    {
      ...parsed.data,
      ...(parsed.data.occurredAt ? { occurredAt: new Date(parsed.data.occurredAt) } : {}),
    },
    { returnDocument: "after" }
  ).lean()

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({
    transaction: {
      id: updated._id.toString(),
      type: updated.type,
      amount: updated.amount,
      category: updated.category,
      merchant: updated.merchant,
      note: updated.note,
      occurredAt: updated.occurredAt,
      createdAt: updated.createdAt,
    },
  })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = getAuthPayload(_req)
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await ctx.params
  await dbConnect()

  const deleted = await Transaction.findOneAndDelete({ _id: id, userId: auth.sub }).lean()
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Revert user balance on delete
  const balanceField = isCreditCategory(deleted.category) ? "creditBalance" : "cashBalance"
  const balanceDelta = deleted.type === "income" ? -deleted.amount : deleted.amount

  await User.findByIdAndUpdate(auth.sub, { $inc: { [balanceField]: balanceDelta } })

  return NextResponse.json({ ok: true })
}
