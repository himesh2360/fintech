import { NextResponse } from "next/server"

import { loadFinancialProfile } from "@/lib/financial-context"
import { getAuthPayload } from "@/lib/request-auth"
import { runTradeoffEngine } from "@/utils/decision-engine"
import { monthKey } from "@/utils/time"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const auth = getAuthPayload(req)
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { title = "Planned Expense", amount = 25000, month = monthKey() } = body

  const profile = await loadFinancialProfile(auth.sub, month)
  const tradeoff = runTradeoffEngine(profile, { title: String(title), amount: Number(amount) })

  return NextResponse.json(tradeoff)
}
