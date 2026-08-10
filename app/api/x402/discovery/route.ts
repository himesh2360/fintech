import { NextResponse } from "next/server"

import {
  buildBusinessModelMeta,
  X402_AGENT_PLAN_PRICE,
  X402_FACILITATOR_URL,
  X402_NETWORK_CAIP2,
  X402_ORCHESTRATOR_PRICE,
  X402_PAY_TO,
  X402_USDC_ASA_ID,
} from "@/lib/x402-config"
import { hasLiveWallet } from "@/lib/x402-live-client"
import { X402_SERVICE_PRICES } from "@/lib/x402-services"

export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json({
    protocol: "x402",
    version: "2.0",
    merchant: "FinSight Agent Treasury",
    category: "Entry Management Framework — Atomic Agent Aggregator",
    network: X402_NETWORK_CAIP2,
    facilitator: X402_FACILITATOR_URL,
    asset: { symbol: "USDC", asaId: X402_USDC_ASA_ID, decimals: 6 },
    payTo: X402_PAY_TO,
    liveWalletConfigured: hasLiveWallet(),
    businessModel: {
      type: "pay-per-call",
      subscriptions: false,
      apiKeysRequired: false,
      payingUser: "Autonomous AI agent or HTTP client",
      settlement: "Algorand USDC via GoPlausible facilitator",
    },
    judgingCriteria: {
      protocolFlow30: "HTTP 402 → client sign → auto retry → facilitator settle → receipt",
      payPerCall25: "No subscriptions; agent pays per request in USDC",
      algorandTech20: "@x402/next + @x402/avm + USDC ASA + txId in response",
      innovation15: "Atomic multi-hop research aggregator + spend policy + VaR/anomaly",
      docs10: "X402.md + /api/x402/discovery + live-pay + client script",
    },
    endpoints: [
      {
        method: "POST",
        path: "/api/v1/agent/execute",
        price: X402_ORCHESTRATOR_PRICE,
        mode: "live",
        description: "Atomic orchestrator entry (official @x402)",
        businessModel: buildBusinessModelMeta("/api/v1/agent/execute", X402_ORCHESTRATOR_PRICE),
      },
      {
        method: "POST",
        path: "/api/x402/agent-plan",
        price: X402_AGENT_PLAN_PRICE,
        mode: "live",
        description: "Economic plan generator",
      },
      {
        method: "POST",
        path: "/api/v1/x402/services/search",
        price: `$${X402_SERVICE_PRICES.search}`,
        mode: "live",
        description: "Multi-hop micro-API #1",
      },
      {
        method: "POST",
        path: "/api/v1/x402/services/llm",
        price: `$${X402_SERVICE_PRICES.llm}`,
        mode: "live",
        description: "Multi-hop micro-API #2",
      },
      {
        method: "POST",
        path: "/api/v1/x402/services/verify",
        price: `$${X402_SERVICE_PRICES.verify}`,
        mode: "live",
        description: "Multi-hop micro-API #3",
      },
      {
        method: "POST",
        path: "/api/v1/agent/spend-policy",
        price: "$0.001",
        mode: "live",
        description: "Agent Spend Policy Guard",
      },
      {
        method: "POST",
        path: "/api/v1/agent/live-pay",
        price: X402_ORCHESTRATOR_PRICE,
        mode: "live-helper",
        description: "Server completes full 402→settle when AVM_PRIVATE_KEY is set",
      },
      {
        method: "POST",
        path: "/api/v1/agent/demo",
        price: X402_ORCHESTRATOR_PRICE,
        mode: "demo",
        description: "UI walkthrough with TX_DEMO_* (not on-chain)",
      },
    ],
    flow: [
      "01 Client Request",
      "02 HTTP 402 Challenge",
      "03 Client Signs USDC payment",
      "04 Auto Retry with X-PAYMENT",
      "05 Facilitator Verify",
      "06 USDC Settle on Algorand",
      "07 Tx Receipt",
      "08 API Response",
    ],
  })
}
