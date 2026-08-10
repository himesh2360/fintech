/** Shared x402 env/config without heavy SDK imports (safe for both client-adjacent and server modules). */

export const X402_IS_MAINNET = (process.env.ALGORAND_NETWORK || "algorand-testnet") === "algorand-mainnet"

/**
 * GoPlausible facilitator CAIP-2 IDs (full genesis hash with padding).
 * Note: @x402/avm exports shorter truncated CAIP-2 strings that do not match /supported.
 */
export const X402_NETWORK_CAIP2 = (
  X402_IS_MAINNET
    ? "algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8="
    : "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="
) as `${string}:${string}`

export const X402_USDC_ASA_ID = X402_IS_MAINNET ? "31566704" : "10458941"

export const X402_PAY_TO =
  process.env.PAY_TO ||
  process.env.ALGORAND_RECEIVER_ADDRESS ||
  "KJSKUHNDIM5FWNQMREFK4Z6AQRHSSKYUYSICDCYWK2J5ULMBPKQABJLPNA"

export const X402_FACILITATOR_URL =
  process.env.FACILITATOR_URL || "https://facilitator.goplausible.xyz"

/** Normalize to `$N.NNN` — Next.js dotenv expands bare `$0` in `.env` to empty. */
function moneyPrice(raw: string | undefined, fallback: string): string {
  const v = (raw || fallback).trim().replace(/^\$+/, "")
  const num = Number(v.replace(/[^0-9.]/g, ""))
  if (!Number.isFinite(num) || num <= 0) return fallback
  return `$${num}`
}

export const X402_ORCHESTRATOR_PRICE = moneyPrice(process.env.X402_PRICE_USDC, "$0.005")
export const X402_AGENT_PLAN_PRICE = moneyPrice(process.env.X402_PLAN_PRICE_USDC, "$0.002")

export function buildBusinessModelMeta(endpoint: string, price: string) {
  return {
    model: "pay-per-call" as const,
    subscriptions: false,
    payingActor: "autonomous_ai_agent_or_client",
    receivingMerchant: "FinSight Agent Treasury",
    settlementAsset: "USDC",
    settlementRail: "Algorand",
    asaId: X402_USDC_ASA_ID,
    network: X402_NETWORK_CAIP2,
    payTo: X402_PAY_TO,
    pricePerCall: price,
    endpoint,
    facilitator: X402_FACILITATOR_URL,
    bazaarTags: ["x402-global-challenge", "agent-orchestrator", "entry-management-framework"],
  }
}
