import { NextResponse } from "next/server"

import { dbConnect } from "@/lib/db"
import { getAuthPayload } from "@/lib/request-auth"
import { Goal } from "@/models/Goal"
import { Transaction } from "@/models/Transaction"
import { User } from "@/models/User"
import { endOfMonth, startOfMonth, monthKey } from "@/utils/time"

export const runtime = "nodejs"

const DEMO_PERSONA = {
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

const DEMO_GOALS = [
  {
    title: "Emergency Fund",
    targetAmount: 288000,
    currentAmount: 288000,
    status: "active",
  },
  {
    title: "Goa Vacation",
    targetAmount: 60000,
    currentAmount: 18000,
    deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 120),
    status: "active",
  },
]

function demoTransactions(userId: string, now = new Date()) {
  const rows: Array<{
    userId: string
    type: "income" | "expense"
    amount: number
    category: string
    merchant: string
    note: string
    occurredAt: Date
  }> = [
    {
      userId,
      type: "expense",
      amount: 18500,
      category: "Utilities & Rent",
      merchant: "Brigade Residency Rent",
      note: "Monthly apartment rent",
      occurredAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 9, 0, 0),
    },
    {
      userId,
      type: "expense",
      amount: 4200,
      category: "Food & Dining",
      merchant: "Swiggy & Zomato",
      note: "Food delivery & weekend dining",
      occurredAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3, 20, 0, 0),
    },
    {
      userId,
      type: "expense",
      amount: 8500,
      category: "EMI",
      merchant: "HDFC Credit Card EMI",
      note: "Electronics purchase EMI",
      occurredAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 5, 10, 0, 0),
    },
    {
      userId,
      type: "expense",
      amount: 6800,
      category: "Shopping",
      merchant: "Amazon India",
      note: "Office accessories",
      occurredAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 8, 15, 0, 0),
    },
    {
      userId,
      type: "income",
      amount: 75000,
      category: "Income",
      merchant: "Tech Corp Salary",
      note: "Monthly salary payout",
      occurredAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 10, 9, 0, 0),
    },
  ]

  return rows
}

export async function POST(req: Request) {
  const auth = getAuthPayload(req)
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await dbConnect()

  // 1. Update the user profile with the rich demo persona snapshot
  await User.findByIdAndUpdate(auth.sub, { $set: DEMO_PERSONA })

  // 2. Replace this month's demo transactions (idempotent re-seed)
  const month = monthKey()
  const start = startOfMonth(new Date())
  const end = endOfMonth(start)

  await Transaction.deleteMany({ userId: auth.sub, occurredAt: { $gte: start, $lte: end } })
  await Transaction.insertMany(demoTransactions(auth.sub))

  // 3. Replace demo goals via the Goal model (same source the dashboard reads)
  await Goal.deleteMany({ userId: auth.sub, title: { $in: DEMO_GOALS.map((g) => g.title) } })
  await Goal.insertMany(DEMO_GOALS.map((g) => ({ userId: auth.sub, ...g })))

  return NextResponse.json({
    success: true,
    month,
    message: "Demo persona ('Rahul - Bangalore') loaded successfully!",
  })
}