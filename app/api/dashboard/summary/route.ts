import { NextResponse } from "next/server"

import { dbConnect } from "@/lib/db"
import { getDecisionBundle } from "@/lib/financial-context"
import { getAuthPayload } from "@/lib/request-auth"
import { Transaction } from "@/models/Transaction"
import { User } from "@/models/User"
import { monthKey } from "@/utils/time"

export const runtime = "nodejs"

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

function isDemoEmail(email?: string | null) {
  const demo = (process.env.DEMO_EMAIL || "demo@finsight.app").toLowerCase()
  return !!email && email.toLowerCase() === demo
}

export async function GET(req: Request) {
  const auth = getAuthPayload(req)
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const month = url.searchParams.get("month") ?? monthKey()

  const bundle = await getDecisionBundle(auth.sub, month)
  const p = bundle.profile

  let user: any = null
  let txns: any[] = []
  try {
    await dbConnect()
    const [userRes, txnsRes] = await Promise.all([
      User.findById(auth.sub).select({ email: 1 }).lean(),
      Transaction.find({
        userId: auth.sub,
        occurredAt: { $gte: new Date(Date.now() - 14 * 86400000) },
      })
        .sort({ occurredAt: -1 })
        .limit(200)
        .lean(),
    ])
    user = userRes
    txns = txnsRes || []
  } catch (err) {
    console.warn("DB connection warning in summary route, returning cached/fallback summary:", err)
  }
  const demo = isDemoEmail(user?.email)

  // Build last-14-day series from real ledger only (no invented bars)
  const byDay = new Map<string, { income: number; expense: number }>()
  for (let i = 0; i < 15; i++) {
    const day = dayKey(new Date(Date.now() - (14 - i) * 86400000))
    byDay.set(day, { income: 0, expense: 0 })
  }
  for (const t of txns) {
    const day = dayKey(new Date(t.occurredAt))
    const slot = byDay.get(day)
    if (!slot) continue
    if (t.type === "income") slot.income += t.amount
    else slot.expense += t.amount
  }
  const incomeVsExpenses = Array.from(byDay.entries()).map(([day, v]) => ({
    day,
    income: Math.round(v.income),
    expense: Math.round(v.expense),
  }))
  const hasCashflowActivity = incomeVsExpenses.some((d) => d.income > 0 || d.expense > 0)

  const expenseBreakdown = Object.entries(p.spendByCategory)
    .filter(([, amount]) => amount > 0)
    .map(([category, amount]) => ({ category, amount: Math.round(amount) }))

  // Portfolio history / asset-class split are not stored for real users.
  // Demo account only may show illustrative series from the seeded profile.
  let investmentGrowth: Array<{ month: string; value: number }> = []
  let portfolio = { equity: 0, mutualFunds: 0, crypto: 0, bonds: 0, other: 0 }
  if (demo && p.investments > 0) {
    const v = p.investments
    investmentGrowth = [
      { month: "2025-09", value: Math.round(v * 0.8) },
      { month: "2025-10", value: Math.round(v * 0.84) },
      { month: "2025-11", value: Math.round(v * 0.88) },
      { month: "2025-12", value: Math.round(v * 0.92) },
      { month: "2026-01", value: Math.round(v * 0.96) },
      { month: "2026-02", value: Math.round(v) },
    ]
    portfolio = {
      equity: Math.round(v * 0.4),
      mutualFunds: Math.round(v * 0.28),
      crypto: Math.round(v * 0.2),
      bonds: Math.round(v * 0.1),
      other: Math.round(v * 0.02),
    }
  }

  const monthIncome = Math.round(p.monthlyIncome)
  const monthExpenses = Math.round(p.monthlyExpenses)
  const upiRecent = txns.slice(0, 5).map((t) => ({
    id: t._id.toString(),
    type: (t.type === "income" ? "received" : "sent") as "received" | "sent",
    amount: Math.round(t.amount),
    from: t.merchant || t.category || (t.type === "income" ? "Income" : "Expense"),
    note: t.note || undefined,
    date: dayKey(new Date(t.occurredAt)),
  }))

  if (bundle.isEmpty) {
    return NextResponse.json({
      month,
      kpis: {
        healthScore: 0,
        totalBalance: 0,
        monthlyIncome: 0,
        monthlyExpenses: 0,
      },
      risk: { riskScore: 0, creditUtilization: 0 },
      charts: {
        expenseBreakdown: [],
        incomeVsExpenses: [],
        investmentGrowth: [],
      },
      budget: { totalBudget: 0, remaining: 0 },
      assets: {
        totalAssets: 0,
        cashBalance: 0,
        investments: 0,
        creditLimit: 0,
        creditBalance: 0,
        netWorth: 0,
      },
      portfolio,
      upi: { received: 0, sent: 0, recent: [] },
      health: bundle.health,
      disclaimer: bundle.disclaimer,
      isEmpty: true,
    })
  }

  const creditUtil = p.creditLimit > 0 ? p.creditBalance / p.creditLimit : 0
  const overspendRatio = p.totalBudget > 0 ? (p.monthlyExpenses - p.totalBudget) / p.totalBudget : 0
  const riskScore = clamp(Math.round(creditUtil * 55 + Math.max(0, overspendRatio) * 35), 0, 100)

  const totalAssets = p.cashBalance + p.investments
  const netWorth = totalAssets - p.creditBalance - p.highInterestDebt

  return NextResponse.json({
    month,
    kpis: {
      healthScore: bundle.health.score,
      totalBalance: Math.round(netWorth),
      monthlyIncome: monthIncome,
      monthlyExpenses: monthExpenses,
    },
    risk: {
      riskScore,
      creditUtilization: Math.round(creditUtil * 100),
    },
    charts: {
      expenseBreakdown,
      incomeVsExpenses: hasCashflowActivity ? incomeVsExpenses : [],
      investmentGrowth,
    },
    budget: {
      totalBudget: p.totalBudget,
      remaining: Math.round(p.totalBudget - p.monthlyExpenses),
    },
    assets: {
      totalAssets: Math.round(totalAssets),
      cashBalance: Math.round(p.cashBalance),
      investments: Math.round(p.investments),
      creditLimit: Math.round(p.creditLimit),
      creditBalance: Math.round(p.creditBalance),
      netWorth: Math.round(netWorth),
    },
    portfolio,
    upi: {
      received: monthIncome,
      sent: monthExpenses,
      recent: upiRecent,
    },
    health: bundle.health,
    disclaimer: bundle.disclaimer,
    isEmpty: false,
  })
}
