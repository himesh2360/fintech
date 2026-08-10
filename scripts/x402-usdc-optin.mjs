#!/usr/bin/env node
import { readFileSync, existsSync } from "fs"
import { resolve } from "path"
import { createRequire } from "module"

const require = createRequire(import.meta.url)
const algosdk = require("algosdk")
const { toClientAvmSigner } = require("@x402/avm")

// load .env manually
const envPath = resolve(process.cwd(), ".env")
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m || process.env[m[1]]) continue
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
}

const USDC_ASA = 10458941
const key = process.env.AVM_PRIVATE_KEY
if (!key) {
  console.error("Missing AVM_PRIVATE_KEY in .env")
  process.exit(1)
}

const signer = toClientAvmSigner(key)
const address = signer.address
const algod = new algosdk.Algodv2("", "https://testnet-api.algonode.cloud", "")

console.log("Wallet:", address)

const info = await algod.accountInformation(address).do()
const algo = Number(info.amount || 0) / 1e6
const assets = info.assets || []
const usdc = assets.find((a) => Number(a["asset-id"] ?? a.assetId) === USDC_ASA)

console.log("ALGO balance:", algo)
console.log("USDC opted-in:", Boolean(usdc))
if (usdc) {
  console.log("USDC balance:", Number(usdc.amount ?? usdc.amount) / 1e6)
  console.log("Already done. Part 3 complete.")
  process.exit(0)
}

if (algo < 0.2) {
  console.error("\nPart 1 incomplete for THIS wallet.")
  console.error("Fund ALGO first:")
  console.error("1) Open https://lora.algokit.io/testnet/fund")
  console.error("2) Paste this address:", address)
  console.error("3) Wait 30-60s, then rerun: node scripts/x402-usdc-optin.mjs")
  process.exit(2)
}

console.log("Sending USDC opt-in txn (ASA", USDC_ASA + ")...")
const suggested = await algod.getTransactionParams().do()
const optin = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
  sender: address,
  receiver: address,
  assetIndex: USDC_ASA,
  amount: 0,
  suggestedParams: suggested,
})

// Sign with raw 64-byte secret from env
const sk = Buffer.from(key, "base64")
const signed = optin.signTxn(sk)
const { txid } = await algod.sendRawTransaction(signed).do()
console.log("Opt-in txId:", txid)
await algosdk.waitForConfirmation(algod, txid, 8)
console.log("SUCCESS: USDC opted-in. Part 3 complete.")
console.log("Now get USDC from https://faucet.circle.com/ (Algorand Testnet) to:", address)
