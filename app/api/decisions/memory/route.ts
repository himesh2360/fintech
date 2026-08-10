import { NextResponse } from "next/server"

import { dbConnect } from "@/lib/db"
import { loadFinancialProfile } from "@/lib/financial-context"
import { getAuthPayload } from "@/lib/request-auth"
import { DecisionLog } from "@/models/DecisionLog"
import { monthKey } from "@/utils/time"

/** FinSight Decision Memory API */
export const runtime = "nodejs"

export async function GET(req: Request) {
  const auth = getAuthPayload(req)
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await dbConnect()
  const profile = await loadFinancialProfile(auth.sub, monthKey())

  let logs = await DecisionLog.find({ userId: auth.sub }).sort({ createdAt: -1 }).lean()

  // Seed default demo decisions if user has none
  if (logs.length === 0) {
    const seed = [
      {
        userId: auth.sub,
        decisionType: "purchase",
        title: "Postponed ₹45k Tech Purchase by 90 Days",
        amount: 45000,
        predictedScoreDelta: 4,
        predictedCashBuffer: profile.cashBalance,
        predictedEmergencyMonths: 6,
        actualCashBuffer: profile.cashBalance + 12000,
        accuracyPct: 94,
        status: "verified",
        verifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
      },
      {
        userId: auth.sub,
        decisionType: "debt_payoff",
        title: "Cleared ₹35k High-Interest Debt",
        amount: 35000,
        predictedScoreDelta: 12,
        predictedCashBuffer: profile.cashBalance - 35000,
        predictedEmergencyMonths: 5.5,
        actualCashBuffer: profile.cashBalance - 33500,
        accuracyPct: 96,
        status: "verified",
        verifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60),
      },
    ]
    await DecisionLog.insertMany(seed)
    logs = await DecisionLog.find({ userId: auth.sub }).sort({ createdAt: -1 }).lean()
  }

  const verifiedLogs = logs.filter((l) => l.status === "verified")
  const avgAccuracy =
    verifiedLogs.length > 0
      ? Math.round(verifiedLogs.reduce((acc, curr) => acc + (curr.accuracyPct || 90), 0) / verifiedLogs.length)
      : 92

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
