import { NextResponse } from "next/server"

import { runAgentOrchestration } from "@/lib/agent-orchestrator"
import { createX402Challenge, verifyAlgorandPayment } from "@/lib/algorand-x402"
import { buildBusinessModelMeta, X402_ORCHESTRATOR_PRICE } from "@/lib/x402-config"

export const runtime = "nodejs"

/**
 * Protocol walkthrough endpoint for demos/judges without a funded wallet.
 * Uses the same orchestration response shape as the live route, but allows TX_DEMO_* proofs.
 * Live settlement remains on POST /api/v1/agent/execute (official @x402).
 */
export async function POST(req: Request) {
  const paymentHeader =
    req.headers.get("x-payment-proof") ||
    req.headers.get("x-algorand-txid") ||
    req.headers.get("x-payment") ||
    req.headers.get("payment-signature")

  if (!paymentHeader) {
    const challenge = createX402Challenge(0.005, "/api/v1/agent/demo")
    return NextResponse.json(
      {
        status: 402,
        error: "Payment Required",
        message: "Demo mode: retry with X-PAYMENT-PROOF: TX_DEMO_<id> OR use live /api/v1/agent/execute with @x402 client",
        x402: challenge,
        businessModel: buildBusinessModelMeta("/api/v1/agent/demo", X402_ORCHESTRATOR_PRICE),
        liveEndpoint: "/api/v1/agent/execute",
      },
      {
        status: 402,
        headers: {
          "WWW-Authenticate": `x402 challenge="${challenge.challengeId}", assetId="${challenge.assetId}", payTo="${challenge.payTo}", amount="${challenge.amountMicroUsdc}"`,
          "X-402-Price-USDC": "0.005",
          "X-402-Mode": "demo-simulation",
        },
      }
    )
  }

  const verification = await verifyAlgorandPayment(paymentHeader, null, 0.005, "Demo Task #1842")
  if (!verification.verified || !verification.receipt) {
    return NextResponse.json({ error: verification.error || "Payment verification failed" }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const result = runAgentOrchestration(body, verification.receipt)

  return NextResponse.json({
    ...result,
    mode: "demo_simulation",
    note: "This demo endpoint simulates settlement for UI walkthroughs. Use /api/v1/agent/execute for live GoPlausible facilitator settlement.",
    businessModel: buildBusinessModelMeta("/api/v1/agent/demo", X402_ORCHESTRATOR_PRICE),
    idempotencyKey: req.headers.get("x-payment-identifier") || `demo_${Date.now()}`,
  })
}
