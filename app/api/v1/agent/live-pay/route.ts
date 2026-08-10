import { NextResponse } from "next/server"

import { hasLiveWallet, payX402Endpoint } from "@/lib/x402-live-client"

export const runtime = "nodejs"

/**
 * Completes the full judging protocol server-side when AVM_PRIVATE_KEY is configured:
 * 402 → sign → retry → facilitator settle → response with real Algorand txId.
 */
export async function POST(req: Request) {
  if (!hasLiveWallet()) {
    return NextResponse.json(
      {
        error: "Live wallet not configured",
        message:
          "Set AVM_PRIVATE_KEY (funded testnet ALGO + USDC ASA 10458941) to run live settle from this endpoint.",
        fallback: "Use POST /api/v1/agent/demo for protocol walkthrough, or scripts/x402-live-client.mjs",
        liveReady: false,
      },
      { status: 501 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const origin = new URL(req.url).origin

  try {
    const result = await payX402Endpoint({
      url: `${origin}/api/v1/agent/execute`,
      body: {
        agentId: body.agentId || "agent-researcher-v1",
        task: body.task || "Create a 5-source AI market research report under $0.20",
        maxBudgetUsdc: body.maxBudgetUsdc ?? 0.2,
        minQuality: body.minQuality ?? 85,
        currentSpentUsdc: body.currentSpentUsdc ?? 0.03,
        currentProgressPct: body.currentProgressPct ?? 74,
        forceAnomalyTrigger: Boolean(body.forceAnomalyTrigger),
      },
    })

    return NextResponse.json({
      liveReady: true,
      mode: "live_facilitator_settle",
      status: result.status,
      settlementTransactionId: result.transaction,
      payer: result.payer,
      settlement: result.settlement,
      result: result.body,
    })
  } catch (err) {
    return NextResponse.json(
      {
        liveReady: true,
        error: err instanceof Error ? err.message : "Live payment failed",
      },
      { status: 502 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    liveReady: hasLiveWallet(),
    endpoint: "/api/v1/agent/live-pay",
    requires: ["AVM_PRIVATE_KEY", "testnet ALGO", "USDC ASA 10458941 opt-in"],
  })
}
