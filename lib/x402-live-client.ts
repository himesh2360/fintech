import { x402Client } from "@x402/core/client"
import { x402HTTPClient } from "@x402/core/http"
import { ExactAvmScheme } from "@x402/avm/exact/client"
import { toClientAvmSigner } from "@x402/avm"

/**
 * Server-side or script client that completes full x402 flow against a local/remote URL.
 * Requires AVM_PRIVATE_KEY (base64 64-byte Algorand key) funded with testnet ALGO + USDC ASA.
 */
export async function payX402Endpoint(opts: {
  url: string
  method?: string
  body?: unknown
  privateKey?: string
}) {
  const privateKey = opts.privateKey || process.env.AVM_PRIVATE_KEY
  if (!privateKey) {
    throw new Error("AVM_PRIVATE_KEY is required for live x402 settlement")
  }

  const signer = toClientAvmSigner(privateKey)
  const core = new x402Client().register("algorand:*", new ExactAvmScheme(signer))
  const client = new x402HTTPClient(core)

  const method = opts.method || "POST"
  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  }

  const unpaid = await fetch(opts.url, init)
  if (unpaid.status !== 402) {
    const text = await unpaid.text()
    throw new Error(`Expected HTTP 402, got ${unpaid.status}: ${text.slice(0, 300)}`)
  }

  const paymentRequired = client.getPaymentRequiredResponse(
    (name) => unpaid.headers.get(name),
    await unpaid.json().catch(() => ({}))
  )

  const paymentPayload = await client.createPaymentPayload(paymentRequired)
  const payHeaders = client.encodePaymentSignatureHeader(paymentPayload)

  const paid = await fetch(opts.url, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string>),
      ...payHeaders,
    },
  })

  const settlement = client.getPaymentSettleResponse((name) => paid.headers.get(name))
  const body = await paid.json().catch(() => ({}))

  return {
    status: paid.status,
    body,
    settlement,
    transaction: settlement?.transaction || body?.settlementTransactionId || null,
    payer: signer.address,
  }
}

export function hasLiveWallet() {
  return Boolean(process.env.AVM_PRIVATE_KEY)
}
