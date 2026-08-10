import { NextResponse } from "next/server"

import { createX402Challenge, verifyAlgorandPayment } from "@/lib/algorand-x402"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const paymentHeader = req.headers.get("x-payment-proof") || req.headers.get("x-algorand-txid")

  // STEP 1 & 2: HTTP 402 Payment Required Challenge if unpaid
  if (!paymentHeader) {
    const challenge = createX402Challenge(0.002, "/api/x402/agent-plan")
    return NextResponse.json(
      {
        status: 402,
        error: "Payment Required",
        message: "Algorand x402 Micropayment Required ($0.002 USDC on Algorand Testnet).",
        x402: challenge,
      },
      {
        status: 402,
        headers: {
          "WWW-Authenticate": `x402 challenge="${challenge.challengeId}", assetId="${challenge.assetId}", payTo="${challenge.payTo}", amount="${challenge.amountMicroUsdc}"`,
          "X-402-Price-USDC": "0.002",
          "X-402-PayTo": challenge.payTo,
        },
      }
    )
  }

  // STEP 3 to 6: Payment Verification
  const verification = await verifyAlgorandPayment(paymentHeader, null, 0.002)
  if (!verification.verified || !verification.receipt) {
    return NextResponse.json({ error: verification.error || "Payment verification failed" }, { status: 403 })
  }

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

  // Economic Engine Optimization (Plan A vs Plan B vs Plan C)
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
    servicesUsed: ["Tavily-Search ($0.002)", "OpenRouter-Llama3.3 ($0.008)", "Verifier-API ($0.003)"],
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

  // Spend / Progress Ratio Anomaly Detection
  let anomalyDetected = false
  let anomalyMessage = "Normal spending efficiency"
  if (currentSpentUsdc > 0.06 && currentProgressPct < 30) {
    anomalyDetected = true
    anomalyMessage = "RUNAWAY_LOOP_WARNING: High spending with low task progress. Recommend auto-rerouting provider."
  }

  // Value-at-Risk Calculation
  const expectedCostUsdc = planB.costUsdc
  const p90CostUsdc = Number((expectedCostUsdc * 1.4).toFixed(3))
  const p99CostUsdc = Number((expectedCostUsdc * 1.8).toFixed(3))

  return NextResponse.json({
    status: 200,
    message: "Economic Execution Plan Generated Successfully!",
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
    // STEP 7 & 8: Algorand Transaction Receipt
    x402Receipt: verification.receipt,
  })
}
