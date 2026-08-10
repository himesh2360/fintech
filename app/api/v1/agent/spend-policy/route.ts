import { type NextRequest, NextResponse } from "next/server"

import { spendPolicyRouteConfig, x402Server, buildBusinessModelMeta } from "@/lib/x402-server"
import { withX402Receipt } from "@/lib/with-x402-receipt"

export const runtime = "nodejs"

/** Agent Spend Policy Guard — Agent Infrastructure sub-track utility. */
async function handler(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const maxBudgetUsdc = Number(body.maxBudgetUsdc ?? 0.2)
  const proposedSpendUsdc = Number(body.proposedSpendUsdc ?? 0.073)
  const dailySpentUsdc = Number(body.dailySpentUsdc ?? 0.04)
  const dailyLimitUsdc = Number(body.dailyLimitUsdc ?? 0.5)

  const withinTaskBudget = proposedSpendUsdc <= maxBudgetUsdc
  const withinDailyLimit = dailySpentUsdc + proposedSpendUsdc <= dailyLimitUsdc
  const allowed = withinTaskBudget && withinDailyLimit

  return NextResponse.json({
    status: 200,
    guard: "AgentSpendPolicy",
    allowed,
    decision: allowed ? "ALLOW_PAYMENT" : "BLOCK_PAYMENT",
    checks: {
      withinTaskBudget,
      withinDailyLimit,
      proposedSpendUsdc,
      maxBudgetUsdc,
      dailySpentUsdc,
      dailyLimitUsdc,
    },
    businessModel: buildBusinessModelMeta("/api/v1/agent/spend-policy", "$0.001"),
  })
}

export const POST = withX402Receipt(handler, spendPolicyRouteConfig(), x402Server, {
  endpoint: "/api/v1/agent/spend-policy",
  price: "$0.001",
  priceUsdc: 0.001,
  taskRef: "spend-policy",
})
