import { type NextRequest, NextResponse } from "next/server"

import { runLlmService } from "@/lib/x402-services"
import { llmServiceRouteConfig, x402Server } from "@/lib/x402-server"
import { withX402Receipt } from "@/lib/with-x402-receipt"

export const runtime = "nodejs"

async function handler(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const result = runLlmService(body.task || "research synthesis", body.sources || [])
  return NextResponse.json({ ok: true, hop: 2, service: result })
}

export const POST = withX402Receipt(handler, llmServiceRouteConfig(), x402Server, {
  endpoint: "/api/v1/x402/services/llm",
  price: "$0.004",
  priceUsdc: 0.004,
  taskRef: "llm-hop",
})
