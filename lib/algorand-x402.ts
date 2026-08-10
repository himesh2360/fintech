/**
 * Algorand x402 helpers: challenge metadata, indexer verification, and demo receipts.
 * Live settlement for production routes is handled by @x402/next + GoPlausible facilitator.
 */

import { X402_NETWORK_CAIP2 as X402_NETWORK, X402_PAY_TO, X402_USDC_ASA_ID } from "@/lib/x402-config"

export type X402Challenge = {
  version: string
  network: string
  assetId: number | string
  assetName: string
  payTo: string
  amountMicroUsdc: number
  priceUsdc: string
  facilitator: string
  challengeId: string
  expiresAt: string
  bazaarTags: string[]
  scheme: "exact"
}

export type SignedServiceReceipt = {
  receiptId: string
  provider: string
  serviceType: string
  paymentUsdc: number
  txId: string
  latencyMs: number
  taskRef: string
  status: "DELIVERED" | "VERIFIED"
  signedBy: string
  timestamp: string
}

export type X402Receipt = {
  txId: string
  network: string
  assetId: number | string
  amountMicroUsdc: number
  payTo: string
  sender: string
  status: "SETTLED_ALGORAND" | "SIMULATED_SETTLEMENT"
  verifiedBy: "GoPlausible" | "AlgoNode" | "FinSight-Simulator"
  settledAt: string
  simulated: boolean
  explorerUrl?: string
  downstreamReceipts: SignedServiceReceipt[]
}

export const ALGORAND_X402_CONFIG = {
  NETWORK: process.env.ALGORAND_NETWORK || "algorand-testnet",
  TESTNET_USDC_ASA_ID: 10458941,
  MAINNET_USDC_ASA_ID: 31566704,
  RECEIVER_ADDRESS: X402_PAY_TO,
  INDEXER_URL:
    process.env.ALGORAND_INDEXER_URL ||
    (process.env.ALGORAND_NETWORK === "algorand-mainnet"
      ? "https://mainnet-idx.algonode.cloud/v2"
      : "https://testnet-idx.algonode.cloud/v2"),
  FACILITATOR_URL: process.env.FACILITATOR_URL || "https://facilitator.goplausible.xyz",
  ALLOW_SIMULATION: process.env.X402_ALLOW_SIMULATION !== "false",
}

export function explorerTxUrl(txId: string) {
  const isMainnet = ALGORAND_X402_CONFIG.NETWORK === "algorand-mainnet"
  return isMainnet
    ? `https://lora.algokit.io/mainnet/transaction/${txId}`
    : `https://lora.algokit.io/testnet/transaction/${txId}`
}

export function createX402Challenge(priceUsdc = 0.005, endpoint = "/api/v1/agent/execute"): X402Challenge {
  void endpoint
  const amountMicroUsdc = Math.round(priceUsdc * 1_000_000)
  const challengeId = `x402_orch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  return {
    version: "2.0",
    scheme: "exact",
    network: X402_NETWORK,
    assetId: X402_USDC_ASA_ID,
    assetName: "USDC",
    payTo: X402_PAY_TO,
    amountMicroUsdc,
    priceUsdc: `$${priceUsdc.toFixed(3)}`,
    facilitator: ALGORAND_X402_CONFIG.FACILITATOR_URL,
    challengeId,
    expiresAt: new Date(Date.now() + 1000 * 60 * 15).toISOString(),
    bazaarTags: ["x402-global-challenge", "agent-orchestrator", "entry-management-framework", "fintech-ai"],
  }
}

function buildDownstreamReceipts(txId: string, taskRef: string): SignedServiceReceipt[] {
  return [
    {
      receiptId: `rcpt_search_${Date.now()}`,
      provider: "TavilySearch-x402",
      serviceType: "Web Search Micro-API",
      paymentUsdc: 0.002,
      txId: `${txId}_HOP1`,
      latencyMs: 320,
      taskRef,
      status: "DELIVERED",
      signedBy: "FinSight-Orchestrator-Treasury",
      timestamp: new Date(Date.now() - 1000 * 3).toISOString(),
    },
    {
      receiptId: `rcpt_llm_${Date.now()}`,
      provider: "OpenRouter-Llama3.3-x402",
      serviceType: "Inference Micro-API",
      paymentUsdc: 0.004,
      txId: `${txId}_HOP2`,
      latencyMs: 1400,
      taskRef,
      status: "DELIVERED",
      signedBy: "FinSight-Orchestrator-Treasury",
      timestamp: new Date(Date.now() - 1000 * 2).toISOString(),
    },
    {
      receiptId: `rcpt_verify_${Date.now()}`,
      provider: "FactCheck-Verifier-x402",
      serviceType: "Verification Micro-API",
      paymentUsdc: 0.001,
      txId: `${txId}_HOP3`,
      latencyMs: 450,
      taskRef,
      status: "VERIFIED",
      signedBy: "FinSight-Orchestrator-Treasury",
      timestamp: new Date(Date.now() - 1000 * 1).toISOString(),
    },
  ]
}

export function buildOrchestratorReceipt(opts: {
  txId: string
  sender?: string
  expectedPriceUsdc?: number
  taskRef?: string
  simulated?: boolean
  verifiedBy?: X402Receipt["verifiedBy"]
}): X402Receipt {
  const expectedPriceUsdc = opts.expectedPriceUsdc ?? 0.005
  const txId = opts.txId
  const simulated = opts.simulated ?? false

  return {
    txId,
    network: X402_NETWORK,
    assetId: X402_USDC_ASA_ID,
    amountMicroUsdc: Math.round(expectedPriceUsdc * 1_000_000),
    payTo: X402_PAY_TO,
    sender: opts.sender || "UNKNOWN_SENDER",
    status: simulated ? "SIMULATED_SETTLEMENT" : "SETTLED_ALGORAND",
    verifiedBy: opts.verifiedBy || (simulated ? "FinSight-Simulator" : "GoPlausible"),
    settledAt: new Date().toISOString(),
    simulated,
    explorerUrl: simulated ? undefined : explorerTxUrl(txId),
    downstreamReceipts: buildDownstreamReceipts(txId, opts.taskRef || "Task #1842"),
  }
}

/** Verify a settled Algorand ASA transfer via public indexer (AlgoNode). */
export async function verifyTxOnIndexer(
  txId: string,
  expectedPriceUsdc = 0.005
): Promise<{ verified: boolean; receipt?: X402Receipt; error?: string }> {
  const cleanTxId = txId.trim()
  if (!cleanTxId || cleanTxId.startsWith("TX_")) {
    return { verified: false, error: "Not a settled Algorand transaction id" }
  }

  try {
    const res = await fetch(`${ALGORAND_X402_CONFIG.INDEXER_URL}/transactions/${cleanTxId}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
    if (!res.ok) {
      return { verified: false, error: `Indexer lookup failed (${res.status})` }
    }

    const data = await res.json()
    const txn = data?.transaction
    const xfer = txn["asset-transfer-transaction"] || txn.assetTransferTransaction
    if (!xfer) {
      return { verified: false, error: "Transaction is not an ASA transfer" }
    }

    const assetId = String(xfer["asset-id"] ?? xfer.assetId ?? "")
    const receiver = String(xfer.receiver || "")
    const amount = Number(xfer.amount || 0)
    const expectedAmount = Math.round(expectedPriceUsdc * 1_000_000)

    if (assetId !== String(X402_USDC_ASA_ID)) {
      return { verified: false, error: `Wrong ASA ${assetId}, expected ${X402_USDC_ASA_ID}` }
    }
    if (receiver && X402_PAY_TO && receiver !== X402_PAY_TO) {
      return { verified: false, error: `Wrong receiver ${receiver}` }
    }
    if (amount < expectedAmount) {
      return { verified: false, error: `Underpaid: got ${amount}, need ${expectedAmount}` }
    }

    return {
      verified: true,
      receipt: buildOrchestratorReceipt({
        txId: cleanTxId,
        sender: String(txn.sender || ""),
        expectedPriceUsdc,
        simulated: false,
        verifiedBy: "AlgoNode",
      }),
    }
  } catch (err) {
    return { verified: false, error: err instanceof Error ? err.message : "Indexer verification failed" }
  }
}

/**
 * Demo / fallback verifier for UI walkthroughs.
 * Accepts TX_DEMO_* proofs only when X402_ALLOW_SIMULATION is enabled.
 */
export async function verifyAlgorandPayment(
  paymentProofHeader?: string | null,
  txIdHeader?: string | null,
  expectedPriceUsdc = 0.005,
  taskRef = "Task #1842"
): Promise<{ verified: boolean; receipt?: X402Receipt; error?: string }> {
  const proof = (paymentProofHeader || txIdHeader || "").trim().replace(/^Bearer\s+/i, "")
  if (!proof) {
    return { verified: false, error: "Missing X-PAYMENT / X-PAYMENT-PROOF / X-ALGORAND-TXID header" }
  }

  // Real settled tx id path
  if (!proof.startsWith("TX_")) {
    const onChain = await verifyTxOnIndexer(proof, expectedPriceUsdc)
    if (onChain.verified) {
      if (onChain.receipt) {
        onChain.receipt.downstreamReceipts = buildDownstreamReceipts(proof, taskRef)
      }
      return onChain
    }
    // If indexer fails but proof looks like a payment payload JSON/base64, reject clearly
    if (!ALGORAND_X402_CONFIG.ALLOW_SIMULATION) {
      return onChain
    }
  }

  if (!ALGORAND_X402_CONFIG.ALLOW_SIMULATION) {
    return {
      verified: false,
      error: "Simulation disabled. Provide a real Algorand tx id or X-PAYMENT payload via @x402 client.",
    }
  }

  if (!proof.startsWith("TX_DEMO_") && !proof.startsWith("TX_ALGO_") && !proof.startsWith("TX_")) {
    return { verified: false, error: "Unrecognized payment proof for simulation mode" }
  }

  const mockTxId = proof.startsWith("TX_") ? proof : `TX_DEMO_${proof.slice(0, 24).toUpperCase()}`
  return {
    verified: true,
    receipt: buildOrchestratorReceipt({
      txId: mockTxId,
      sender: "DEMO_AGENT_WALLET",
      expectedPriceUsdc,
      taskRef,
      simulated: true,
      verifiedBy: "FinSight-Simulator",
    }),
  }
}
