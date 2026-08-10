import { Budget } from "@/models/Budget"
import { DecisionLog } from "@/models/DecisionLog"
import { Goal } from "@/models/Goal"
import { Transaction } from "@/models/Transaction"
import { User } from "@/models/User"
import { endOfMonth, startOfMonth, monthKey } from "@/utils/time"

export const DEMO_PERSONA = {
  name: "Rahul Sharma",
  monthlyIncome: 75000,
  monthlyExpenses: 48000,
  totalBudget: 50000,
  cashBalance: 420000,
  investments: 358500,
  creditLimit: 300000,
  creditBalance: 105000,
  highInterestDebt: 105000,
  savingsYieldPct: 6.5,
  debtInterestPct: 14,
  emergencyMonthsTarget: 6,
}

export const DEMO_GOALS = [
  {
    title: "Emergency Fund",
    targetAmount: 288000,
    currentAmount: 288000,
    status: "active" as const,
  },
  {
    title: "Goa Vacation",
    targetAmount: 60000,
    currentAmount: 18000,
    deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 120),
    status: "active" as const,
  },
]

export function demoTransactions(userId: string, now = new Date()) {
  return [
    {
      userId,
      type: "expense" as const,
      amount: 18500,
      category: "Utilities & Rent",
      merchant: "Brigade Residency Rent",
      note: "Monthly apartment rent",
      occurredAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 9, 0, 0),
    },
    {
      userId,
      type: "expense" as const,
      amount: 4200,
      category: "Food & Dining",
      merchant: "Swiggy & Zomato",
      note: "Food delivery & weekend dining",
      occurredAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3, 20, 0, 0),
    },
    {
      userId,
      type: "expense" as const,
      amount: 8500,
      category: "EMI",
      merchant: "HDFC Credit Card EMI",
      note: "Electronics purchase EMI",
      occurredAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 5, 10, 0, 0),
    },
    {
      userId,
      type: "expense" as const,
      amount: 6800,
      category: "Shopping",
      merchant: "Amazon India",
      note: "Office accessories",
      occurredAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 8, 15, 0, 0),
    },
    {
      userId,
      type: "income" as const,
      amount: 75000,
      category: "Income",
      merchant: "Tech Corp Salary",
      note: "Monthly salary payout",
      occurredAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 10, 9, 0, 0),
    },
  ]
}

/** Apply demo persona data to the dedicated demo user only. */
export async function seedDemoUserData(userId: string) {
  const month = monthKey()
  const start = startOfMonth(new Date())
  const end = endOfMonth(start)

  await User.findByIdAndUpdate(userId, { $set: DEMO_PERSONA })
  await Transaction.deleteMany({ userId, occurredAt: { $gte: start, $lte: end } })
  await Transaction.insertMany(demoTransactions(userId))
  await Goal.deleteMany({ userId, title: { $in: DEMO_GOALS.map((g) => g.title) } })
  await Goal.insertMany(DEMO_GOALS.map((g) => ({ userId, ...g })))
  await Budget.findOneAndUpdate(
    { userId, month },
    {
      totalBudget: DEMO_PERSONA.totalBudget,
      categoryBudgets: {
        "Utilities & Rent": 20000,
        "Food & Dining": 8000,
        EMI: 10000,
        Shopping: 7000,
        Transport: 5000,
      },
    },
    { upsert: true, returnDocument: "after" }
  )
  // Clear any previously auto-seeded fake decision-memory rows
  await DecisionLog.deleteMany({ userId })

  return month
}
