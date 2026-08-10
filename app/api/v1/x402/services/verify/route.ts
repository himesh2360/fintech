import { type NextRequest, NextResponse } from "next/server"

import { runVerifyService } from "@/lib/x402-services"
import { verifyServiceRouteConfig, x402Server } from "@/lib/x402-server"
import { withX402Receipt } from "@/lib/with-x402-receipt"

export const runtime = "nodejs"

async function handler(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const result = runVerifyService(body.draft || body.text || "research draft")
  return NextResponse.json({ ok: true, hop: 3, service: result })
}

export const POST = withX402Receipt(handler, verifyServiceRouteConfig(), x402Server, {
  endpoint: "/api/v1/x402/services/verify",
  price: "$0.001",
  priceUsdc: 0.001,
  taskRef: "verify-hop",
})
