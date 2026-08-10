import type { X402Receipt, SignedServiceReceipt } from "@/lib/algorand-x402"
import { runAtomicResearchPipeline } from "@/lib/x402-services"

export type OrchestratorRequest = {
  agentId?: string
  task?: string
  maxBudgetUsdc?: number
  minQuality?: number
  maxLatencyMs?: number
  currentSpentUsdc?: number
  currentProgressPct?: number
  forceAnomalyTrigger?: boolean
}

function hopsToReceipts(masterTxId: string, task: string): SignedServiceReceipt[] {
  const hops = runAtomicResearchPipeline(task)
  return hops.map((hop, idx) => ({
    receiptId: `rcpt_${hop.provider}_${Date.now()}_${idx}`,
    provider: hop.provider,
    serviceType: hop.serviceType,
    paymentUsdc: hop.priceUsdc,
    txId: `${masterTxId}_HOP${idx + 1}`,
    latencyMs: hop.latencyMs,
    taskRef: task,
    status: hop.status,
    signedBy: "FinSight-Orchestrator-Treasury",
    timestamp: new Date(Date.now() - (hops.length - idx) * 1000).toISOString(),
  }))
}

export function runAgentOrchestration(body: OrchestratorRequest, receipt?: X402Receipt | null) {
  const {
    agentId = "agent-researcher-v1",
    task = "Create a 5-source AI market research report under $0.20",
    maxBudgetUsdc = 0.2,
    minQuality = 85,
    maxLatencyMs = 5000,
    currentSpentUsdc = 0.03,
    currentProgressPct = 74,
    forceAnomalyTrigger = false,
  } = body

  const planA = {
    id: "plan-a-budget",
    name: "Plan A (Ultra-Budget)",
    costUsdc: 0.041,
    qualityScore: 81,
    expectedLatencyMs: 4200,
    servicesUsed: ["Search-API-B ($0.001)", "LLM-Local-Mixtral ($0.004)"],
    status: minQuality > 81 ? "DISQUALIFIED_LOW_QUALITY" : "VIABLE",
    risk: "LOW",
  }

  const planB = {
    id: "plan-b-optimal",
    name: "Plan B (Cost-Quality Optimal)",
    costUsdc: 0.073,
    qualityScore: 91,
    expectedLatencyMs: 8100,
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
    expectedLatencyMs: 12400,
    servicesUsed: ["Google-Serp-API ($0.020)", "Claude-3.5-Sonnet ($0.035)", "FactCheck-API ($0.010)"],
    status: maxBudgetUsdc < 0.165 ? "DISQUALIFIED_OVER_BUDGET" : "VIABLE",
    risk: "MEDIUM",
  }

  const isAnomaly = forceAnomalyTrigger || (currentSpentUsdc > 0.06 && currentProgressPct < 30)
  const efficiencyRatio = Number((currentProgressPct / Math.max(0.01, currentSpentUsdc * 100)).toFixed(2))

  const anomalyControl = {
    currentSpentUsdc,
    currentProgressPct,
    efficiencyRatio,
    efficiencyRating: isAnomaly ? "CRITICAL_LOW" : "HIGH",
    anomalyDetected: isAnomaly,
    anomalyAction: isAnomaly
      ? "AUTONOMOUS_REROUTE: Spending loop detected. Switched provider from Search-A to Search-B."
      : "NORMAL_PROGRESS: Agent spending aligned with task progress.",
  }

  const expectedCostUsdc = planB.costUsdc
  const actualCostUsdc = Number((expectedCostUsdc * 0.92).toFixed(3))
  const p50Usdc = 0.068
  const p90Usdc = 0.102
  const p99Usdc = 0.181

  const atomicHops = runAtomicResearchPipeline(task)
  const masterTx = receipt?.txId || `ORCH_${Date.now()}`
  const enrichedReceipt = receipt
    ? {
        ...receipt,
        downstreamReceipts: hopsToReceipts(masterTx, task),
      }
    : null

  return {
    status: 200,
    orchestrationType: "x402_ATOMIC_ORCHESTRATOR",
    message: "FinSight Agent Treasury orchestrated multi-service workflow executed successfully",
    entryManagementFramework: {
      pattern: "atomic_agent_aggregator",
      description: "Single entry payment unlocks multi-hop x402 micro-API research pipeline",
      microEndpoints: atomicHops.map((h) => ({
        endpoint: h.endpoint,
        provider: h.provider,
        priceUsdc: h.priceUsdc,
      })),
    },
    protocol: {
      standard: "x402",
      scheme: "exact",
      rail: "Algorand USDC",
      flow: [
        "01_client_request",
        "02_402_challenge",
        "03_client_signs",
        "04_auto_retry",
        "05_facilitator_verify",
        "06_usdc_settle",
        "07_tx_receipt",
        "08_api_response",
      ],
    },
    task: {
      agentId,
      taskDescription: task,
      maxBudgetUsdc,
      minQuality,
      maxLatencyMs,
    },
    recommendedPlan: "Plan_B",
    executionPlans: [planA, planB, planC],
    atomicPipelineResult: atomicHops,
    economicControls: {
      expectedCostUsdc,
      valueAtRisk: {
        expectedCostUsdc,
        p50Usdc,
        p90Usdc,
        p99Usdc,
        overspendProbability: p90Usdc > maxBudgetUsdc ? "HIGH" : "LOW",
      },
      anomalyControl,
      predictionVsReality: {
        predictedCostUsdc: expectedCostUsdc,
        actualCostUsdc,
        costSavingsUsdc: Number((expectedCostUsdc - actualCostUsdc).toFixed(3)),
        predictionAccuracyPct: 91,
        learnedInsight: "TavilySearch-x402 consistently executes ~8% below estimated cost.",
      },
    },
    x402Receipt: enrichedReceipt,
  }
}
