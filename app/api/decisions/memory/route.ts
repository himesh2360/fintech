import { NextResponse } from "next/server"

import { dbConnect } from "@/lib/db"
import { loadFinancialProfile } from "@/lib/financial-context"
import { getAuthPayload } from "@/lib/request-auth"
import { DecisionLog } from "@/models/DecisionLog"
import { monthKey } from "@/utils/time"

/** FinSight Decision Memory API — returns only real logged decisions (no auto-seeded fake history). */
export const runtime = "nodejs"

export async function GET(req: Request) {
  const auth = getAuthPayload(req)
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await dbConnect()

  const logs = await DecisionLog.find({ userId: auth.sub }).sort({ createdAt: -1 }).lean()
  const verifiedLogs = logs.filter((l) => l.status === "verified" && typeof l.accuracyPct === "number")
  const avgAccuracy =
    verifiedLogs.length > 0
      ? Math.round(verifiedLogs.reduce((acc, curr) => acc + (curr.accuracyPct || 0), 0) / verifiedLogs.length)
      : 0

  const totalCapitalSaved = logs.reduce((acc, curr) => acc + (curr.amount || 0), 0)

  return NextResponse.json({
    logs,
    avgAccuracyPct: avgAccuracy,
    totalCapitalSaved,
  })
}

export async function POST(req: Request) {
  const auth = getAuthPayload(req)
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { title, amount, decisionType = "purchase", predictedScoreDelta = 0 } = body

  if (!title || !amount) {
    return NextResponse.json({ error: "Title and amount required" }, { status: 400 })
  }

  await dbConnect()
  const profile = await loadFinancialProfile(auth.sub, monthKey())

  const newLog = await DecisionLog.create({
    userId: auth.sub,
    decisionType,
    title: String(title),
    amount: Number(amount),
    predictedScoreDelta: Number(predictedScoreDelta),
    predictedCashBuffer: profile.cashBalance,
    predictedEmergencyMonths: Number((profile.cashBalance / Math.max(1, profile.monthlyExpenses)).toFixed(1)),
    status: "active",
  })

  return NextResponse.json(newLog, { status: 201 })
}
