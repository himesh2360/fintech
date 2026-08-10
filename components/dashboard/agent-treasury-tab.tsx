"use client"

import * as React from "react"
import { CheckCircle2Icon, ExternalLinkIcon, ShieldAlertIcon, TrendingUpIcon, ZapIcon } from "lucide-react"
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
  assetId: number | string
  amountMicroUsdc: number
  payTo: string
  sender: string
  status: string
  verifiedBy: string
  settledAt: string
  simulated?: boolean
  explorerUrl?: string
  downstreamReceipts: SignedServiceReceipt[]
}

type LiveChallenge = {
  amount?: string
  asset?: string
  network?: string
  payTo?: string
  scheme?: string
}

export function AgentTreasuryTab() {
  const [loading, setLoading] = React.useState(false)
  const [step, setStep] = React.useState<number>(0)
  const [receipt, setReceipt] = React.useState<X402Receipt | null>(null)
  const [plans, setPlans] = React.useState<PlanItem[]>([])
  const [liveChallenge, setLiveChallenge] = React.useState<LiveChallenge | null>(null)
  const [liveReady, setLiveReady] = React.useState(false)
  const [modeLabel, setModeLabel] = React.useState<"demo" | "live">("demo")
  const [predictionData, setPredictionData] = React.useState<{
    predictedCostUsdc?: number
    actualCostUsdc?: number
    costSavingsUsdc?: number
    predictionAccuracyPct?: number
    learnedInsight?: string
  } | null>(null)
  const [anomalyData, setAnomalyData] = React.useState<{
    currentSpentUsdc?: number
    currentProgressPct?: number
    efficiencyRatio?: number
    efficiencyRating?: string
    anomalyDetected?: boolean
    anomalyAction?: string
  } | null>(null)

  React.useEffect(() => {
    fetch("/api/v1/agent/live-pay")
      .then((r) => r.json())
      .then((d) => setLiveReady(Boolean(d.liveReady)))
      .catch(() => setLiveReady(false))
  }, [])

  const payload = (triggerAnomaly: boolean) => ({
    agentId: "agent-researcher-v1",
    task: "Create a 5-source AI market research report under $0.20",
    maxBudgetUsdc: 0.2,
    minQuality: 85,
    currentSpentUsdc: triggerAnomaly ? 0.08 : 0.03,
    currentProgressPct: triggerAnomaly ? 21 : 74,
    forceAnomalyTrigger: triggerAnomaly,
  })

  const applyResult = (paidData: Record<string, unknown>) => {
    const result = (paidData.result as Record<string, unknown>) || paidData
    setReceipt((result.x402Receipt as X402Receipt) || null)
    setPlans((result.executionPlans as PlanItem[]) || [])
    const econ = result.economicControls as {
      predictionVsReality?: typeof predictionData
      anomalyControl?: typeof anomalyData
    }
    setPredictionData(econ?.predictionVsReality || null)
    setAnomalyData(econ?.anomalyControl || null)
  }

  const handleRunOrchestratorFlow = async (triggerAnomaly = false, preferLive = false) => {
    setLoading(true)
    setStep(1)
    setReceipt(null)
    setPredictionData(null)
    setAnomalyData(null)
    setLiveChallenge(null)

    try {
      await new Promise((r) => setTimeout(r, 250))
      setStep(2)

      const res402 = await fetch("/api/v1/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload(triggerAnomaly)),
      })
      const challengeBody = await res402.json().catch(() => ({}))

      if (res402.status !== 402) {
        toast.error(`Expected live HTTP 402 from /api/v1/agent/execute, got ${res402.status}`)
        return
      }

      const accepts = challengeBody?.x402?.accepts?.[0] || {}
      setLiveChallenge({
        amount: accepts.amount,
        asset: accepts.asset,
        network: accepts.network,
        payTo: accepts.payTo,
        scheme: accepts.scheme,
      })
      toast.info(
        `LIVE 402: ${accepts.amount || "5000"} µUSDC ASA ${accepts.asset || "10458941"} via GoPlausible`
      )

      const searchRes = await fetch("/api/v1/x402/services/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "AI market research" }),
      })

      await new Promise((r) => setTimeout(r, 400))
      setStep(3)
      await new Promise((r) => setTimeout(r, 350))
      setStep(4)
      await new Promise((r) => setTimeout(r, 350))
      setStep(5)

      if (preferLive || liveReady) {
        const liveRes = await fetch("/api/v1/agent/live-pay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload(triggerAnomaly)),
        })
        const paidLive = await liveRes.json()
        if (liveRes.ok && paidLive?.settlementTransactionId) {
          setModeLabel("live")
          setStep(6)
          await new Promise((r) => setTimeout(r, 350))
          setStep(7)
          applyResult(paidLive)
          setStep(8)
          toast.success(`Live settle complete — tx ${String(paidLive.settlementTransactionId).slice(0, 18)}…`)
          return
        }
        if (preferLive) {
          toast.warning(String(paidLive?.message || paidLive?.error || "Live wallet not ready — falling back to demo"))
        }
      }

      setModeLabel("demo")
      const resPaid = await fetch("/api/v1/agent/demo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT-PROOF": `TX_DEMO_${Date.now()}_ORCH`,
          "X-Payment-Identifier": `idemp_${Date.now()}`,
        },
        body: JSON.stringify(payload(triggerAnomaly)),
      })

      setStep(6)
      const paidData = await resPaid.json()
      if (!resPaid.ok) {
        toast.error(String(paidData?.error || "Demo payment verification failed"))
        return
      }

      await new Promise((r) => setTimeout(r, 350))
      setStep(7)
      applyResult(paidData)
      await new Promise((r) => setTimeout(r, 250))
      setStep(8)

      if (triggerAnomaly) {
        toast.warning("AUTONOMOUS REROUTE: Spending Loop Anomaly Detected & Rerouted!")
      } else {
        toast.success("Protocol complete: live 402 proven + orchestration receipts returned")
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
      <Card className="p-6 rounded-3xl border-border bg-gradient-to-br from-card via-slate-900 to-teal-950/50 text-white shadow-xl space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-teal-500/20 px-3 py-1 text-xs font-bold text-teal-300 border border-teal-500/40">
                Entry Management Framework
              </span>
              <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-200 border border-emerald-500/40">
                Live @x402 execute
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold border ${
                  liveReady
                    ? "bg-teal-500/20 text-teal-200 border-teal-500/40"
                    : "bg-amber-500/20 text-amber-200 border-amber-500/40"
                }`}
              >
                {liveReady ? "AVM wallet ready" : "Demo settle (set AVM_PRIVATE_KEY for live)"}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-1 text-white">
              FinSight Agent Treasury 2.0
            </h2>
            <p className="text-xs text-slate-300 max-w-xl">
              Full judging flow: live HTTP 402 from official @x402 → sign/retry/settle → multi-hop x402
              micro-APIs → receipt with Algorand USDC tx metadata.
            </p>
          </div>

          <div className="flex flex-col gap-2 shrink-0 sm:flex-row">
            <Button
              disabled={loading}
              onClick={() => handleRunOrchestratorFlow(false, false)}
              className="rounded-2xl gap-2 font-bold text-xs h-10 px-5 bg-teal-500 text-slate-950 hover:bg-teal-400"
            >
              <ZapIcon className="size-4" />
              <span>Run Protocol ($0.005)</span>
            </Button>
            <Button
              disabled={loading || !liveReady}
              onClick={() => handleRunOrchestratorFlow(false, true)}
              variant="outline"
              className="rounded-2xl gap-1.5 font-semibold text-xs h-10 px-4 border-teal-500/50 text-teal-200 hover:bg-teal-950/40"
            >
              Live Settle
            </Button>
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => handleRunOrchestratorFlow(true, false)}
              className="rounded-2xl gap-1.5 font-semibold text-xs h-10 px-4 border-rose-500/50 text-rose-300 hover:bg-rose-950/40"
            >
              <ShieldAlertIcon className="size-4 text-rose-400" />
              <span>Anomaly Guard</span>
            </Button>
          </div>
        </div>

        {liveChallenge && (
          <div className="grid gap-2 sm:grid-cols-4 text-[11px] border-t border-slate-800 pt-3">
            <div>
              <div className="text-slate-500">LIVE amount (µUSDC)</div>
              <div className="font-mono font-bold">{liveChallenge.amount || "—"}</div>
            </div>
            <div>
              <div className="text-slate-500">ASA</div>
              <div className="font-mono font-bold">{liveChallenge.asset || "—"}</div>
            </div>
            <div>
              <div className="text-slate-500">Scheme</div>
              <div className="font-bold">{liveChallenge.scheme || "exact"}</div>
            </div>
            <div>
              <div className="text-slate-500">Settle mode</div>
              <div className="font-bold uppercase">{modeLabel}</div>
            </div>
          </div>
        )}

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

      {receipt && (
        <Card className="p-5 rounded-3xl border-teal-500/30 bg-card shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2Icon className="size-5 text-teal-500" />
              <h3 className="text-sm font-bold text-foreground">Algorand Orchestrator Master Receipt</h3>
            </div>
            <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-500/30">
              {receipt.simulated !== false ? "Simulated" : "Verified"} • {receipt.verifiedBy}
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
                <div className="font-bold text-teal-600">AlgoKit Lora</div>
              </div>
              <a
                href={receipt.explorerUrl || `https://lora.algokit.io/testnet/transaction/${receipt.txId}`}
                target="_blank"
                rel="noreferrer"
                className={`p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground ${
                  receipt.simulated ? "pointer-events-none opacity-40" : ""
                }`}
                aria-disabled={receipt.simulated}
                onClick={(e) => {
                  if (receipt.simulated) e.preventDefault()
                }}
              >
                <ExternalLinkIcon className="size-4" />
              </a>
            </div>
          </div>

          {receipt.downstreamReceipts && receipt.downstreamReceipts.length > 0 && (
            <div className="space-y-2 pt-1 border-t border-border/60">
              <div className="text-xs font-bold text-foreground">
                Multi-Hop Signed Service Receipts (atomic x402 micro-APIs)
              </div>
              <div className="grid gap-2 sm:grid-cols-3 text-xs">
                {receipt.downstreamReceipts.map((rcpt) => (
                  <div key={rcpt.receiptId} className="p-3 rounded-2xl border border-border/60 bg-muted/20 space-y-1">
                    <div className="flex justify-between font-bold text-foreground text-[11px]">
                      <span>{rcpt.provider}</span>
                      <span className="text-emerald-600">${rcpt.paymentUsdc} USDC</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {rcpt.serviceType} • {rcpt.latencyMs}ms
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground truncate">Tx: {rcpt.txId}</div>
                    <div className="text-[9px] font-semibold text-teal-600 pt-0.5">Signed: {rcpt.signedBy}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

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

      {plans.length > 0 && (
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-bold text-foreground">Orchestrated Execution Plans (Cost vs Quality vs Latency)</h3>
            <p className="text-xs text-muted-foreground">
              Atomic Entry Management routes pay-per-call micro-APIs under a single orchestrator payment.
            </p>
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
                      p.status === "RECOMMENDED" ? "bg-teal-500 text-slate-950" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="text-xl font-extrabold text-foreground">${p.costUsdc} USDC</div>
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>
                      Quality: <strong>{p.qualityScore}/100</strong>
                    </span>
                    <span>
                      Latency: <strong>{p.expectedLatencyMs}ms</strong>
                    </span>
                  </div>
                </div>
                <div className="border-t border-border/60 pt-2 space-y-1">
                  <div className="text-[10px] font-semibold text-muted-foreground">Atomic Workflow Route:</div>
                  <div className="text-[11px] text-foreground font-mono leading-tight">{p.servicesUsed.join(" ➔ ")}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
