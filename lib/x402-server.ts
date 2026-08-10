import { HTTPFacilitatorClient, type RouteConfig } from "@x402/core/server"
import { ExactAvmScheme } from "@x402/avm/exact/server"
import { x402ResourceServer } from "@x402/next"

import {
  X402_AGENT_PLAN_PRICE,
  X402_FACILITATOR_URL,
  X402_NETWORK_CAIP2,
  X402_ORCHESTRATOR_PRICE,
  X402_PAY_TO,
  X402_USDC_ASA_ID,
} from "@/lib/x402-config"
import { X402_SERVICE_PRICES } from "@/lib/x402-services"

export {
  X402_PAY_TO,
  X402_FACILITATOR_URL,
  X402_ORCHESTRATOR_PRICE,
  X402_AGENT_PLAN_PRICE,
  X402_NETWORK_CAIP2 as X402_NETWORK,
  X402_USDC_ASA_ID,
  buildBusinessModelMeta,
} from "@/lib/x402-config"

const facilitatorClient = new HTTPFacilitatorClient({
  url: X402_FACILITATOR_URL,
})

export const x402Server = new x402ResourceServer(facilitatorClient).register(
  "algorand:*",
  new ExactAvmScheme()
)

function pricedRoute(price: string, description: string): RouteConfig {
  return {
    accepts: {
      scheme: "exact",
      network: X402_NETWORK_CAIP2,
      payTo: X402_PAY_TO,
      price,
      extra: { asset: X402_USDC_ASA_ID },
    },
    description,
    mimeType: "application/json",
  }
}

export function orchestratorRouteConfig(): RouteConfig {
  return pricedRoute(
    X402_ORCHESTRATOR_PRICE,
    "FinSight Agent Treasury — atomic multi-service research orchestration (pay-per-call, no subscription)"
  )
}

export function agentPlanRouteConfig(): RouteConfig {
  return pricedRoute(X402_AGENT_PLAN_PRICE, "FinSight economic execution plan generator (pay-per-call)")
}

export function searchServiceRouteConfig(): RouteConfig {
  return pricedRoute(`$${X402_SERVICE_PRICES.search}`, "x402 search micro-API (Entry Management hop 1)")
}

export function llmServiceRouteConfig(): RouteConfig {
  return pricedRoute(`$${X402_SERVICE_PRICES.llm}`, "x402 LLM synthesis micro-API (Entry Management hop 2)")
}

export function verifyServiceRouteConfig(): RouteConfig {
  return pricedRoute(`$${X402_SERVICE_PRICES.verify}`, "x402 fact-check micro-API (Entry Management hop 3)")
}

export function spendPolicyRouteConfig(): RouteConfig {
  return pricedRoute("$0.001", "Agent Spend Policy Guard — enforce budgets before autonomous payments")
}
