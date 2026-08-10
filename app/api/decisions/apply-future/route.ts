import { NextResponse } from "next/server"

import { dbConnect } from "@/lib/db"
import { getAuthPayload } from "@/lib/request-auth"
import { DecisionLog } from "@/models/DecisionLog"
import { Goal } from "@/models/Goal"
import { Transaction } from "@/models/Transaction"
import { User } from "@/models/User"

export const runtime = "nodejs"

type FutureKey = "BUY_NOW" | "WAIT_3_MONTHS" | "INVEST_SURPLUS" | "CLEAR_DEBT"

/**
 * Apply a selected Decision Future to the user's real ledger:
 * - BUY_NOW: expense + cash down
 * - WAIT_3_MONTHS: create savings goal (no cash move yet)
 * - INVEST_SURPLUS: cash -> investments + investment expense txn
 * - CLEAR_DEBT: cash down + credit/debt down + debt payment txn
 * Always writes a DecisionLog entry.
 */
export async function POST(req: Request) {
  const auth = getAuthPayload(req)
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const futureKey = String(body.futureKey || "") as FutureKey
  const title = String(body.title || "Planned Purchase").trim()
  const amount = Math.max(0, Number(body.amount) || 0)
  const predictedScoreDelta = Number(body.predictedScoreDelta) || 0

  const allowed: FutureKey[] = ["BUY_NOW", "WAIT_3_MONTHS", "INVEST_SURPLUS", "CLEAR_DEBT"]
  if (!allowed.includes(futureKey)) {
    return NextResponse.json({ error: "Invalid futureKey" }, { status: 400 })
  }
  if (!title || amount <= 0) {
    return NextResponse.json({ error: "Title and a positive amount are required" }, { status: 400 })
  }

  await dbConnect()
  const user = await User.findById(auth.sub)
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const cash = Number(user.cashBalance || 0)
  const credit = Number(user.creditBalance || 0)
  const debt = Number(user.highInterestDebt || 0)
  const investments = Number(user.investments || 0)
  const monthlyExpenses = Math.max(1, Number(user.monthlyExpenses || 1))

  const actions: string[] = []
  let decisionType: "purchase" | "debt_payoff" | "sip_increase" = "purchase"
  let transactionId: string | null = null
  let goalId: string | null = null

  if (futureKey === "BUY_NOW") {
    if (cash < amount) {
      return NextResponse.json(
        {
          error: `Insufficient cash. Need Rs.${amount.toLocaleString("en-IN")}, have Rs.${cash.toLocaleString("en-IN")}.`,
        },
        { status: 400 }
      )
    }
    user.cashBalance = cash - amount
    const txn = await Transaction.create({
      userId: auth.sub,
      type: "expense",
      amount,
      category: "Shopping",
      merchant: title,
      note: `Decision Future applied: Buy Immediately - ${title}`,
      occurredAt: new Date(),
      tags: ["decision-future", "buy-now"],
    })
    transactionId = String(txn._id)
    actions.push(`Spent Rs.${amount.toLocaleString("en-IN")} from cash`)
    actions.push(`Cash balance now Rs.${Number(user.cashBalance).toLocaleString("en-IN")}`)
    decisionType = "purchase"
  } else if (futureKey === "WAIT_3_MONTHS") {
    const deadline = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90)
    const goal = await Goal.create({
      userId: auth.sub,
      title: `Save for ${title}`,
      targetAmount: amount,
      currentAmount: 0,
      deadline,
      status: "active",
    })
    goalId = String(goal._id)
    actions.push(`Created 90-day savings goal for Rs.${amount.toLocaleString("en-IN")}`)
    actions.push("Cash left untouched - save toward this goal")
    decisionType = "purchase"
  } else if (futureKey === "INVEST_SURPLUS") {
    if (cash < amount) {
      return NextResponse.json(
        {
          error: `Insufficient cash to invest. Need Rs.${amount.toLocaleString("en-IN")}, have Rs.${cash.toLocaleString("en-IN")}.`,
        },
        { status: 400 }
      )
    }
    user.cashBalance = cash - amount
    user.investments = investments + amount
    const txn = await Transaction.create({
      userId: auth.sub,
      type: "expense",
      amount,
      category: "Investments",
      merchant: "FinSight Invest",
      note: `Decision Future applied: Invest instead of ${title}`,
      occurredAt: new Date(),
      tags: ["decision-future", "invest-surplus"],
    })
    transactionId = String(txn._id)
    actions.push(`Moved Rs.${amount.toLocaleString("en-IN")} from cash -> investments`)
    actions.push(`Investments now Rs.${Number(user.investments).toLocaleString("en-IN")}`)
    decisionType = "sip_increase"
  } else if (futureKey === "CLEAR_DEBT") {
    if (cash < amount) {
      return NextResponse.json(
        {
          error: `Insufficient cash for debt payoff. Need Rs.${amount.toLocaleString("en-IN")}, have Rs.${cash.toLocaleString("en-IN")}.`,
        },
        { status: 400 }
      )
    }
    const totalDebt = credit + debt
    if (totalDebt <= 0) {
      return NextResponse.json({ error: "No high-interest debt or credit balance to pay down." }, { status: 400 })
    }
    const pay = Math.min(amount, totalDebt)
    user.cashBalance = cash - pay

    const creditPay = Math.min(pay, credit)
    user.creditBalance = credit - creditPay
    const remaining = pay - creditPay
    user.highInterestDebt = Math.max(0, debt - remaining)

    const txn = await Transaction.create({
      userId: auth.sub,
      type: "expense",
      amount: pay,
      category: "Credit Card",
      merchant: "Debt Paydown",
      note: `Decision Future applied: Pay debt instead of ${title}`,
      occurredAt: new Date(),
      tags: ["decision-future", "clear-debt"],
    })
    transactionId = String(txn._id)
    actions.push(`Paid Rs.${pay.toLocaleString("en-IN")} toward debt/credit`)
    actions.push(
      `Credit Rs.${Number(user.creditBalance).toLocaleString("en-IN")} | High-interest debt Rs.${Number(user.highInterestDebt).toLocaleString("en-IN")}`
    )
    decisionType = "debt_payoff"
  }

  await user.save()

  const log = await DecisionLog.create({
    userId: auth.sub,
    decisionType,
    title: `${futureKey}: ${title}`,
    amount,
    predictedScoreDelta,
    predictedCashBuffer: Number(user.cashBalance || 0),
    predictedEmergencyMonths: Number((Number(user.cashBalance || 0) / monthlyExpenses).toFixed(1)),
    status: "active",
  })

  return NextResponse.json({
    ok: true,
    futureKey,
    amount,
    actions,
    decisionLogId: String(log._id),
    transactionId,
    goalId,
    balances: {
      cashBalance: Number(user.cashBalance || 0),
      investments: Number(user.investments || 0),
      creditBalance: Number(user.creditBalance || 0),
      highInterestDebt: Number(user.highInterestDebt || 0),
    },
  })
}
