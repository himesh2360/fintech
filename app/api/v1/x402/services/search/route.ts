import { type NextRequest, NextResponse } from "next/server"

import { runSearchService } from "@/lib/x402-services"
import { searchServiceRouteConfig, x402Server } from "@/lib/x402-server"
import { withX402Receipt } from "@/lib/with-x402-receipt"

export const runtime = "nodejs"

async function handler(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const result = runSearchService(body.task || body.query || "AI market research")
  return NextResponse.json({ ok: true, hop: 1, service: result })
}

export const POST = withX402Receipt(handler, searchServiceRouteConfig(), x402Server, {
  endpoint: "/api/v1/x402/services/search",
  price: "$0.002",
  priceUsdc: 0.002,
  taskRef: "search-hop",
})
