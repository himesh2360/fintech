#!/usr/bin/env node
/**
 * Full judging protocol client:
 * 402 Challenge → Client Sign → Auto Retry → Facilitator Settle → Tx receipt in response
 *
 * Usage:
 *   AVM_PRIVATE_KEY=... node scripts/x402-live-client.mjs
 *   AVM_PRIVATE_KEY=... node scripts/x402-live-client.mjs http://localhost:3000/api/v1/agent/execute
 */
import { createRequire } from "module"
import { readFileSync, existsSync } from "fs"
import { resolve } from "path"

const require = createRequire(import.meta.url)
const envPath = resolve(process.cwd(), ".env")
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m || process.env[m[1]]) continue
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
}

const { x402Client } = require("@x402/core/client")
const { x402HTTPClient } = require("@x402/core/http")
const { ExactAvmScheme } = require("@x402/avm/exact/client")
const { toClientAvmSigner } = require("@x402/avm")

const url = process.argv[2] || "http://localhost:3000/api/v1/agent/execute"
const privateKey = process.env.AVM_PRIVATE_KEY

if (!privateKey) {
  console.error("Missing AVM_PRIVATE_KEY")
  console.error("Fund testnet wallet with ALGO + USDC ASA 10458941, then export AVM_PRIVATE_KEY")
  process.exit(1)
}

const signer = toClientAvmSigner(privateKey)
const core = new x402Client().register("algorand:*", new ExactAvmScheme(signer))
const client = new x402HTTPClient(core)

const body = JSON.stringify({
  agentId: "agent-researcher-v1",
  task: "Create a 5-source AI market research report under $0.20",
  maxBudgetUsdc: 0.2,
  minQuality: 85,
})

console.log("01 Client Request →", url)
const unpaid = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body,
})
console.log("02 402 Challenge →", unpaid.status)
if (unpaid.status !== 402) {
  console.error(await unpaid.text())
  process.exit(1)
}

const paymentRequired = client.getPaymentRequiredResponse(
  (name) => unpaid.headers.get(name),
  await unpaid.json().catch(() => ({}))
)
console.log("03 Client Sign (payer)", signer.address)
const paymentPayload = await client.createPaymentPayload(paymentRequired)
const payHeaders = client.encodePaymentSignatureHeader(paymentPayload)

console.log("04 Auto Retry with PAYMENT header")
const paid = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...payHeaders },
  body,
})

const settlement = client.getPaymentSettleResponse((name) => paid.headers.get(name))
const json = await paid.json().catch(() => ({}))
console.log("05-07 Facilitator settle / receipt")
console.log("HTTP", paid.status)
console.log("transaction", settlement?.transaction || json.settlementTransactionId)
console.log("08 API keys", Object.keys(json).slice(0, 12))
if (json.x402Receipt) console.log("x402Receipt.txId", json.x402Receipt.txId)
