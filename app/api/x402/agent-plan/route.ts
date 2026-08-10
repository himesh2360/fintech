import { type NextRequest, NextResponse } from "next/server"

import { buildOrchestratorReceipt } from "@/lib/algorand-x402"
import {
  agentPlanRouteConfig,
  buildBusinessModelMeta,
  X402_AGENT_PLAN_PRICE,
  x402Server,
} from "@/lib/x402-server"
import { withX402Receipt } from "@/lib/with-x402-receipt"

export const runtime = "nodejs"

async function handler(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const {
    agentId = "agent-researcher-v1",
    task = "Synthesize 5-source AI market research report",
    maxBudgetUsdc = 0.2,
    minQuality = 85,
    maxLatencyMs = 5000,
    currentSpentUsdc = 0,
    currentProgressPct = 100,
  } = body

  const planA = {
    id: "plan-a-budget",
    name: "Plan A (Ultra-Budget)",
    costUsdc: 0.041,
    qualityScore: 81,
    expectedLatencyMs: 1200,
    servicesUsed: ["Search-API-B ($0.001)", "LLM-Local-Mixtral ($0.004)"],
    status: minQuality > 81 ? "DISQUALIFIED_LOW_QUALITY" : "VIABLE",
    risk: "LOW",
  }

  const planB = {
    id: "plan-b-optimal",
    name: "Plan B (Cost-Quality Optimal)",
    costUsdc: 0.073,
    qualityScore: 91,
    expectedLatencyMs: 2100,
    servicesUsed: [
      "/api/v1/x402/services/search ($0.002)",
      "/api/v1/x402/services/llm ($0.004)",
      "/api/v1/x402/services/verify ($0.001)",
    ],
    status: "RECOMMENDED",
    risk: "LOW",
  }

  const planC = {
    id: "plan-c-premium",
    name: "Plan C (Premium Quality)",
    costUsdc: 0.165,
    qualityScore: 96,
    expectedLatencyMs: 3800,
    servicesUsed: ["Google-Serp-API ($0.020)", "Claude-3.5-Sonnet ($0.035)", "FactCheck-API ($0.010)"],
    status: maxBudgetUsdc < 0.165 ? "DISQUALIFIED_OVER_BUDGET" : "VIABLE",
    risk: "MEDIUM",
  }

  let anomalyDetected = false
  let anomalyMessage = "Normal spending efficiency"
  if (currentSpentUsdc > 0.06 && currentProgressPct < 30) {
    anomalyDetected = true
    anomalyMessage =
      "RUNAWAY_LOOP_WARNING: High spending with low task progress. Recommend auto-rerouting provider."
  }

  const expectedCostUsdc = planB.costUsdc
  const p90CostUsdc = Number((expectedCostUsdc * 1.4).toFixed(3))
  const p99CostUsdc = Number((expectedCostUsdc * 1.8).toFixed(3))

  const receipt = buildOrchestratorReceipt({
    txId: `PENDING_SETTLE_${Date.now()}`,
    expectedPriceUsdc: 0.002,
    taskRef: task,
    simulated: false,
    verifiedBy: "GoPlausible",
  })

  return NextResponse.json({
    status: 200,
    message: "Economic Execution Plan Generated Successfully",
    businessModel: buildBusinessModelMeta("/api/x402/agent-plan", X402_AGENT_PLAN_PRICE),
    task: {
      agentId,
      taskDescription: task,
      maxBudgetUsdc,
      minQuality,
      maxLatencyMs,
    },
    recommendedPlan: "Plan_B",
    executionPlans: [planA, planB, planC],
    economicControls: {
      expectedCostUsdc,
      valueAtRisk: {
        p50Usdc: expectedCostUsdc,
        p90Usdc: p90CostUsdc,
        p99Usdc: p99CostUsdc,
        overspendRisk: p90CostUsdc > maxBudgetUsdc ? "HIGH" : "LOW",
      },
      efficiencyRatio: {
        currentSpentUsdc,
        currentProgressPct,
        anomalyDetected,
        anomalyMessage,
      },
    },
    x402Receipt: receipt,
  })
}

export const POST = withX402Receipt(handler, agentPlanRouteConfig(), x402Server, {
  endpoint: "/api/x402/agent-plan",
  price: X402_AGENT_PLAN_PRICE,
  priceUsdc: 0.002,
  taskRef: "agent-plan",
})
