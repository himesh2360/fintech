import { Types } from "mongoose"
import { dbConnect } from "@/lib/db"
import { isDemoUser } from "@/lib/demo"
import { Budget } from "@/models/Budget"
import { Goal } from "@/models/Goal"
import { Transaction } from "@/models/Transaction"
import { User } from "@/models/User"
import {
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

/**
 * Build a FinancialProfile from the user's real MongoDB data only.
 * No silent fallback to invented demo amounts for any account.
 */
export async function loadFinancialProfile(userId: string, month = monthKey()): Promise<FinancialProfile> {
  try {
    await dbConnect()
    const user = await User.findById(userId).lean()
    if (!user) {
      return starterFinancialProfile(month)
    }

    const { start, end } = parseMonth(month)
    const userObjId = new Types.ObjectId(userId)

    const [budget, goals, totalsAggregation, categoryAggregation] = await Promise.all([
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
    ])

    let monthlyIncome = 0
    let monthlyExpenses = 0
    for (const item of totalsAggregation) {
      if (item._id === "income") monthlyIncome = item.total
      else if (item._id === "expense") monthlyExpenses = item.total
    }

    // Prefer live ledger totals; fall back to stored snapshot fields only when ledger is empty
    if (monthlyIncome <= 0 && typeof user.monthlyIncome === "number") {
      monthlyIncome = user.monthlyIncome
    }
    if (monthlyExpenses <= 0 && typeof user.monthlyExpenses === "number") {
      monthlyExpenses = user.monthlyExpenses
    }

    const spendByCategory: Record<string, number> = {}
    for (const cat of categoryAggregation) {
      if (cat._id) spendByCategory[cat._id] = cat.total
    }

    const mappedGoals = goals.map((g) => ({
      title: g.title,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      deadline: g.deadline ? new Date(g.deadline).toISOString() : null,
      status: g.status,
    }))

    return starterFinancialProfile(month, {
      currency: user.currency || "INR",
      monthlyIncome,
      monthlyExpenses,
      totalBudget: user.totalBudget ?? budget?.totalBudget ?? 0,
      cashBalance: user.cashBalance ?? 0,
      investments: user.investments ?? 0,
      creditLimit: user.creditLimit ?? 0,
      creditBalance: user.creditBalance ?? 0,
      highInterestDebt: user.highInterestDebt ?? 0,
      savingsYieldPct: user.savingsYieldPct ?? 6.5,
      debtInterestPct: user.debtInterestPct ?? 9.0,
      emergencyMonthsTarget: user.emergencyMonthsTarget ?? 6,
      goals: mappedGoals,
      spendByCategory,
    })
  } catch {
    return starterFinancialProfile(month)
  }
}

export async function getDecisionBundle(userId: string, month = monthKey()): Promise<DecisionBundle> {
  const profile = await loadFinancialProfile(userId, month)
  return runDecisionEngine(profile)
}

export { isDemoUser }
