import { NextResponse } from "next/server"
import { z } from "zod"

import { dbConnect } from "@/lib/db"
import { getAuthPayload } from "@/lib/request-auth"
import { User } from "@/models/User"

export const runtime = "nodejs"

const UpdateSettingsSchema = z.object({
  currency: z.string().min(1).max(5).optional(),
  savingsYieldPct: z.number().min(0).max(50).optional(),
  debtInterestPct: z.number().min(0).max(100).optional(),
  emergencyMonthsTarget: z.number().min(1).max(24).optional(),
})

export async function GET(req: Request) {
  const auth = getAuthPayload(req)
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await dbConnect()
  const user = await User.findById(auth.sub).lean()
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  return NextResponse.json({
    settings: {
      currency: user.currency || "INR",
      savingsYieldPct: user.savingsYieldPct ?? 6.5,
      debtInterestPct: user.debtInterestPct ?? 9.0,
      emergencyMonthsTarget: user.emergencyMonthsTarget ?? 6,
    },
  })
}

export async function PATCH(req: Request) {
  const auth = getAuthPayload(req)
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = UpdateSettingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings", issues: parsed.error.flatten() }, { status: 400 })
  }

  await dbConnect()
  const updated = await User.findByIdAndUpdate(auth.sub, { $set: parsed.data }, { returnDocument: "after" }).lean()

  if (!updated) return NextResponse.json({ error: "User not found" }, { status: 404 })

  return NextResponse.json({
    settings: {
      currency: updated.currency,
      savingsYieldPct: updated.savingsYieldPct,
      debtInterestPct: updated.debtInterestPct,
      emergencyMonthsTarget: updated.emergencyMonthsTarget,
    },
  })
}
