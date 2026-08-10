"use client"

import * as React from "react"
import { AlertCircleIcon, ArrowRightIcon, CheckCircle2Icon, ExternalLinkIcon, ShieldAlertIcon, SparklesIcon, TrendingUpIcon, ZapIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

type PlanItem = {
  id: string
  name: string
  costUsdc: number
  qualityScore: number
  expectedLatencyMs: number
  servicesUsed: string[]
  status: string
  risk: string
}

type SignedServiceReceipt = {
  receiptId: string
  provider: string
  serviceType: string
  paymentUsdc: number
  txId: string
  latencyMs: number
  taskRef: string
  status: string
  signedBy: string
  timestamp: string
}

type X402Receipt = {
  txId: string
  network: string
  assetId: number
  amountMicroUsdc: number
  payTo: string
  sender: string
  status: string
  verifiedBy: string
  settledAt: string
  downstreamReceipts: SignedServiceReceipt[]
}

export function AgentTreasuryTab() {
  const [loading, setLoading] = React.useState(false)
  const [step, setStep] = React.useState<number>(0)
  const [receipt, setReceipt] = React.useState<X402Receipt | null>(null)
  const [plans, setPlans] = React.useState<PlanItem[]>([])
  const [predictionData, setPredictionData] = React.useState<any>(null)
  const [anomalyData, setAnomalyData] = React.useState<any>(null)

  const handleRunOrchestratorFlow = async (triggerAnomaly = false) => {
    setLoading(true)
    setStep(1) // 01 Client Request
    setReceipt(null)
    setPredictionData(null)
    setAnomalyData(null)

    try {
      // Step 1: Unpaid request -> Expect HTTP 402
      await new Promise((r) => setTimeout(r, 350))
      setStep(2) // 02 402 Challenge Received

      const res402 = await fetch("/api/v1/agent/execute", { method: "POST" })
      const data402 = await res402.json()

      if (res402.status === 402) {
        toast.info(`HTTP 402 Challenge: Payment Required ($0.005 USDC on Algorand Testnet ASA 10458941)`)
        await new Promise((r) => setTimeout(r, 500))
        setStep(3) // 03 Client Signs & Pays USDC

        await new Promise((r) => setTimeout(r, 500))
        setStep(4) // 04 Auto Retry with X-PAYMENT-PROOF

        await new Promise((r) => setTimeout(r, 500))
        setStep(5) // 05 GoPlausible Facilitator Verification

        // Step 2: Retry with Payment Proof header -> FinSight Orchestrates Downstream Payments
        const resPaid = await fetch("/api/v1/agent/execute", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-PAYMENT-PROOF": `TX_ALGO_${Date.now()}_ORCH`,
            "X-Payment-Identifier": `idemp_${Date.now()}`,
          },
          body: JSON.stringify({
            agentId: "agent-researcher-v1",
            task: "Create a 5-source AI market research report under $0.20",
            maxBudgetUsdc: 0.2,
            minQuality: 85,
            currentSpentUsdc: triggerAnomaly ? 0.08 : 0.03,
            currentProgressPct: triggerAnomaly ? 21 : 74,
            forceAnomalyTrigger: triggerAnomaly,
          }),
        })

        setStep(6) // 06 USDC Settle & Multi-Hop Downstream Micropayments
        const paidData = await resPaid.json()

        await new Promise((r) => setTimeout(r, 450))
        setStep(7) // 07 Signed Receipts Received
        setReceipt(paidData.x402Receipt)
        setPlans(paidData.executionPlans || [])
        setPredictionData(paidData.economicControls?.predictionVsReality)
        setAnomalyData(paidData.economicControls?.anomalyControl)

        await new Promise((r) => setTimeout(r, 350))
        setStep(8) // 08 Orchestration Complete

        if (triggerAnomaly) {
          toast.warning("AUTONOMOUS REROUTE: Spending Loop Anomaly Detected & Rerouted!")
        } else {
          toast.success("Orchestration Complete: Multi-Hop x402 Micropayments Settled on Algorand!")
        }
      }
    } catch {
      toast.error("Error executing x402 orchestrator workflow")
    } finally {
      setLoading(false)
    }
  }

  const stepsList = [
    "01 Client Request",
    "02 402 Challenge",
    "03 Client Sign",
    "04 Auto Retry",
    "05 Facilitator",
    "06 Multi-Hop Settle",
    "07 Signed Receipts",
    "08 Orchestration Complete",
  ]

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <Card className="p-6 rounded-3xl border-border bg-gradient-to-br from-card via-slate-900 to-teal-950/50 text-white shadow-xl space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-teal-500/20 px-3 py-1 text-xs font-bold text-teal-300 border border-teal-500/40">
                x402 Orchestrator Entry
              </span>
              <span className="text-xs font-semibold text-slate-400">Algorand Testnet ASA: 10458941 (USDC)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-1 text-white">
              FinSight Agent Treasury 2.0
            </h2>
            <p className="text-xs text-slate-300 max-w-xl">
              An economic orchestration layer that plans, budgets, routes, pays downstream x402 micro-services,
              detects spending loops, and issues signed service receipts on Algorand.
            </p>
          </div>

          <div className="flex flex-col gap-2 shrink-0 sm:flex-row">
            <Button
              disabled={loading}
              onClick={() => handleRunOrchestratorFlow(false)}
              className="rounded-2xl gap-2 font-bold text-xs h-10 px-5 bg-teal-500 text-slate-950 hover:bg-teal-400"
            >
              <ZapIcon className="size-4" />
              <span>Execute x402 Orchestrator ($0.005 USDC)</span>
            </Button>
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => handleRunOrchestratorFlow(true)}
              className="rounded-2xl gap-1.5 font-semibold text-xs h-10 px-4 border-rose-500/50 text-rose-300 hover:bg-rose-950/40"
            >
              <ShieldAlertIcon className="size-4 text-rose-400" />
              <span>Test Loop Anomaly Guard</span>
            </Button>
          </div>
        </div>

        {/* 8-Step x402 Orchestrator Protocol Flow Visualizer */}
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            8-Step Algorand x402 Multi-Hop Orchestration Pipeline
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-8">
            {stepsList.map((stName, idx) => {
              const currentStepNum = idx + 1
              const isActive = step === currentStepNum
              const isCompleted = step > currentStepNum

              return (
                <div
                  key={idx}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    isCompleted
                      ? "border-teal-500/50 bg-teal-950/60 text-teal-300"
                      : isActive
                        ? "border-teal-400 bg-teal-500/20 text-white ring-2 ring-teal-400 animate-pulse"
                        : "border-slate-800 bg-slate-900/60 text-slate-500"
                  }`}
                >
                  <div className="text-[10px] font-bold truncate">{stName}</div>
                </div>
              )
            })}
          </div>
        </div>
      </Card>

      {/* Algorand Master Receipt & Downstream Signed Receipts */}
      {receipt && (
        <Card className="p-5 rounded-3xl border-teal-500/30 bg-card shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2Icon className="size-5 text-teal-500" />
              <h3 className="text-sm font-bold text-foreground">Algorand Orchestrator Master Receipt</h3>
            </div>
            <span className="rounded-full bg-teal-500/10 px-2.5 py-0.5 text-[11px] font-bold text-teal-600 border border-teal-500/30">
              Verified by GoPlausible • ASA 10458941
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-4 text-xs">
            <div className="p-2.5 rounded-xl bg-muted/30 border border-border/60">
              <div className="text-[10px] text-muted-foreground">Master Transaction ID</div>
              <div className="font-mono font-bold text-foreground truncate">{receipt.txId}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-muted/30 border border-border/60">
              <div className="text-[10px] text-muted-foreground">Orchestrator Fee</div>
              <div className="font-bold text-foreground">{receipt.amountMicroUsdc / 1000000} USDC ($0.005)</div>
            </div>
            <div className="p-2.5 rounded-xl bg-muted/30 border border-border/60">
              <div className="text-[10px] text-muted-foreground">Algorand Network</div>
              <div className="font-bold text-foreground">Algorand Testnet</div>
            </div>
            <div className="p-2.5 rounded-xl bg-muted/30 border border-border/60 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-muted-foreground">Explorer</div>
                <div className="font-bold text-teal-600">AlgoExplorer</div>
              </div>
              <a
                href={`https://testnet.algoexplorer.io/tx/${receipt.txId}`}
                target="_blank"
                rel="noreferrer"
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <ExternalLinkIcon className="size-4" />
              </a>
            </div>
          </div>

          {/* Downstream Signed Micro-Service Receipts */}
          {receipt.downstreamReceipts && receipt.downstreamReceipts.length > 0 && (
            <div className="space-y-2 pt-1 border-t border-border/60">
              <div className="text-xs font-bold text-foreground flex items-center gap-2">
                <span>Multi-Hop Signed Service Receipts (FinSight Paid Downstream via x402)</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 text-xs">
                {receipt.downstreamReceipts.map((rcpt) => (
                  <div key={rcpt.receiptId} className="p-3 rounded-2xl border border-border/60 bg-muted/20 space-y-1">
                    <div className="flex justify-between font-bold text-foreground text-[11px]">
                      <span>{rcpt.provider}</span>
                      <span className="text-emerald-600">${rcpt.paymentUsdc} USDC</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">{rcpt.serviceType} • {rcpt.latencyMs}ms</div>
                    <div className="text-[10px] font-mono text-muted-foreground truncate">Tx: {rcpt.txId}</div>
                    <div className="text-[9px] font-semibold text-teal-600 pt-0.5">Signed: {rcpt.signedBy}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Prediction vs Reality Memory Ledger */}
      {predictionData && (
        <Card className="p-4 rounded-2xl border-border/80 bg-gradient-to-r from-card via-card to-teal-500/5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUpIcon className="size-4.5 text-teal-500" />
              <span className="text-xs font-bold text-foreground">Prediction vs. Reality Learning Ledger</span>
            </div>
            <span className="rounded-full bg-teal-500/10 px-2 py-0.5 text-[10px] font-bold text-teal-600">
              {predictionData.predictionAccuracyPct}% Accuracy
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 text-xs">
            <div className="p-2.5 rounded-xl bg-background border border-border/40">
              <div className="text-[10px] text-muted-foreground">Predicted Cost</div>
              <div className="font-bold text-foreground">${predictionData.predictedCostUsdc} USDC</div>
            </div>
            <div className="p-2.5 rounded-xl bg-background border border-border/40">
              <div className="text-[10px] text-muted-foreground">Actual Spent</div>
              <div className="font-bold text-emerald-600">${predictionData.actualCostUsdc} USDC</div>
            </div>
            <div className="p-2.5 rounded-xl bg-background border border-border/40">
              <div className="text-[10px] text-muted-foreground">Learned Optimization</div>
              <div className="text-[11px] text-muted-foreground truncate">{predictionData.learnedInsight}</div>
            </div>
          </div>
        </Card>
      )}

      {/* Economic Execution Plan Comparison Cards (Plan A vs B vs C) */}
      {plans.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Orchestrated Execution Plans (Cost vs Quality vs Latency)</h3>
              <p className="text-xs text-muted-foreground">
                FinSight discovers paid endpoints from Bazaar, balances quality, and routes micropayments.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {plans.map((p) => (
              <div
                key={p.id}
                className={`p-4 rounded-2xl border transition-all space-y-3 ${
                  p.status === "RECOMMENDED"
                    ? "border-teal-500 bg-teal-500/5 ring-1 ring-teal-500/30"
                    : "border-border/60 bg-card"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">{p.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      p.status === "RECOMMENDED"
                        ? "bg-teal-500 text-slate-950"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {p.status}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-xl font-extrabold text-foreground">${p.costUsdc} USDC</div>
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Quality: <strong>{p.qualityScore}/100</strong></span>
                    <span>Latency: <strong>{p.expectedLatencyMs}ms</strong></span>
                  </div>
                </div>

                <div className="border-t border-border/60 pt-2 space-y-1">
                  <div className="text-[10px] font-semibold text-muted-foreground">Atomic Workflow Route:</div>
                  <div className="text-[11px] text-foreground font-mono leading-tight">
                    {p.servicesUsed.join(" ➔ ")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spend / Progress Anomaly Warning Box */}
      {anomalyData?.anomalyDetected && (
        <Card className="p-4 rounded-2xl border-rose-500/40 bg-rose-950/20 text-rose-200 space-y-2">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
            <ShieldAlertIcon className="size-4" />
            <span>RUNAWAY SPENDING LOOP DETECTED (Efficiency: {anomalyData.efficiencyRating})</span>
          </div>
          <p className="text-xs text-rose-300">{anomalyData.anomalyAction}</p>
        </Card>
      )}
    </div>
  )
}
