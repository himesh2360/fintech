import { Types } from "mongoose"
import { dbConnect } from "@/lib/db"
import { Budget } from "@/models/Budget"
import { Goal } from "@/models/Goal"
import { Transaction } from "@/models/Transaction"
import { User } from "@/models/User"
import {
  demoFinancialProfile,
  starterFinancialProfile,
  type FinancialProfile,
  runDecisionEngine,
  type DecisionBundle,
} from "@/utils/decision-engine"
import { endOfMonth, monthKey } from "@/utils/time"

function parseMonth(month: string) {
  const [y, m] = month.split("-").map(Number)
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0)
  const end = endOfMonth(start)
  return { start, end }
}

function demoEmail() {
  return (process.env.DEMO_EMAIL || "demo@finsight.app").toLowerCase()
}

function isDemoUser(email?: string | null) {
  return !!email && email.toLowerCase() === demoEmail()
}

/**
 * Build a FinancialProfile from the user's real MongoDB data.
 * Uses high-performance MongoDB aggregation pipelines for spend metrics
 * and hydrates custom user decision preferences.
 */
export async function loadFinancialProfile(userId: string, month = monthKey()): Promise<FinancialProfile> {
  try {
    await dbConnect()
    const user = await User.findById(userId).lean()
    if (!user) {
      return starterFinancialProfile(month)
    }

    const demo = isDemoUser(user.email)
    const { start, end } = parseMonth(month)

    const userObjId = new Types.ObjectId(userId)

    const [budget, goals, totalsAggregation, categoryAggregation, txnDocs] = await Promise.all([
      Budget.findOne({ userId, month }).lean(),
      Goal.find({ userId }).limit(20).lean(),
      Transaction.aggregate<{ _id: string; total: number }>([
        { $match: { userId: userObjId, occurredAt: { $gte: start, $lte: end } } },
        { $group: { _id: "$type", total: { $sum: "$amount" } } },
      ]),
      Transaction.aggregate<{ _id: string; total: number }>([
        { $match: { userId: userObjId, type: "expense", occurredAt: { $gte: start, $lte: end } } },
        { $group: { _id: "$category", total: { $sum: "$amount" } } },
      ]),
      Transaction.find({ userId, occurredAt: { $gte: start, $lte: end } }).limit(500).lean(),
    ])

    let monthlyIncome = 0
    let monthlyExpenses = 0
    for (const item of totalsAggregation) {
      if (item._id === "income") monthlyIncome = item.total
      else if (item._id === "expense") monthlyExpenses = item.total
    }

    const spendByCategory: Record<string, number> = {}
    for (const cat of categoryAggregation) {
      if (cat._id) {
        spendByCategory[cat._id] = cat.total
      }
    }

    const mappedGoals = goals.map((g) => ({
      title: g.title,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      deadline: g.deadline ? new Date(g.deadline).toISOString() : null,
      status: g.status,
    }))

    // Hydrate user settings or defaults
    const savingsYieldPct = user.savingsYieldPct ?? 6.5
    const debtInterestPct = user.debtInterestPct ?? 9.0
    const emergencyMonthsTarget = user.emergencyMonthsTarget ?? 6

    // Demo account: if seed data is thin/missing, fall back to rich demo story
    if (demo && txnDocs.length < 3) {
      return {
        ...demoFinancialProfile(month),
        currency: user.currency || "INR",
        cashBalance: user.cashBalance ?? demoFinancialProfile(month).cashBalance,
        creditLimit: user.creditLimit ?? demoFinancialProfile(month).creditLimit,
        creditBalance: user.creditBalance ?? demoFinancialProfile(month).creditBalance,
        savingsYieldPct,
        debtInterestPct,
        emergencyMonthsTarget,
        goals: mappedGoals.length > 0 ? mappedGoals : demoFinancialProfile(month).goals,
      }
    }

    // Real signup users: actual data with user preferences
    if (!demo) {
      return starterFinancialProfile(month, {
        currency: user.currency || "INR",
        monthlyIncome,
        monthlyExpenses,
        totalBudget: budget?.totalBudget ?? 0,
        cashBalance: user.cashBalance ?? 0,
        investments: 0,
        creditLimit: user.creditLimit ?? 0,
        creditBalance: user.creditBalance ?? 0,
        highInterestDebt: 0,
        savingsYieldPct,
        debtInterestPct,
        emergencyMonthsTarget,
        goals: mappedGoals,
        spendByCategory,
      })
    }

    // Demo with live seeded numbers
    const fallback = demoFinancialProfile(month)
    return {
      month,
      currency: user.currency || "INR",
      monthlyIncome: monthlyIncome || fallback.monthlyIncome,
      monthlyExpenses: monthlyExpenses || fallback.monthlyExpenses,
      totalBudget: user.totalBudget ?? budget?.totalBudget ?? fallback.totalBudget,
      cashBalance: user.cashBalance ?? fallback.cashBalance,
      investments: user.investments ?? fallback.investments,
      creditLimit: user.creditLimit ?? fallback.creditLimit,
      creditBalance: user.creditBalance ?? fallback.creditBalance,
      highInterestDebt: user.highInterestDebt ?? fallback.highInterestDebt,
      savingsYieldPct,
      debtInterestPct,
      liquidYieldPct: fallback.liquidYieldPct,
      equityIllustrativePct: fallback.equityIllustrativePct,
      emergencyMonthsTarget,
      goals: mappedGoals.length > 0 ? mappedGoals : fallback.goals,
      spendByCategory: Object.keys(spendByCategory).length ? spendByCategory : fallback.spendByCategory,
    }
  } catch {
    return starterFinancialProfile(month)
  }
}

export async function getDecisionBundle(userId: string, month = monthKey()): Promise<DecisionBundle> {
  const profile = await loadFinancialProfile(userId, month)
  return runDecisionEngine(profile)
}
