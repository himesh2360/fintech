"use client"

import * as React from "react"
import { ArrowRightIcon, CheckCircle2Icon, SparklesIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

type Future = {
  key: "BUY_NOW" | "WAIT_3_MONTHS" | "INVEST_SURPLUS" | "CLEAR_DEBT"
  title: string
  description: string
  liquidCashLeft: number
  emergencyMonthsLeft: number
  scoreDelta: number
  opportunityCost: string
  verdict: string
}

type TradeoffData = {
  itemTitle: string
  amount: number
  baselineScore: number
  futures: Future[]
  recommendedFutureKey: string
  why: string
}

export function TradeoffModal({
  open,
  onOpenChange,
  presetTitle = "Laptop Purchase",
  presetAmount = 45000,
  onApplied,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  presetTitle?: string
  presetAmount?: number
  onApplied?: () => void
}) {
  const [title, setTitle] = React.useState(presetTitle)
  const [amount, setAmount] = React.useState(presetAmount)
  const [loading, setLoading] = React.useState(false)
  const [data, setData] = React.useState<TradeoffData | null>(null)
  const [saving, setSaving] = React.useState(false)

  const runAnalysis = React.useCallback(async (t: string, a: number) => {
    setLoading(true)
    try {
      const res = await fetch("/api/decisions/tradeoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t, amount: a }),
      })
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch {
      toast.error("Failed to run decision analysis")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (open) {
      setTitle(presetTitle)
      setAmount(presetAmount)
      runAnalysis(presetTitle, presetAmount)
    }
  }, [open, presetTitle, presetAmount, runAnalysis])

  const handleApplyFuture = async (future: Future) => {
    if (!data) return
    setSaving(true)
    try {
      const res = await fetch("/api/decisions/apply-future", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          futureKey: future.key,
          title: data.itemTitle || title,
          amount: data.amount || amount,
          predictedScoreDelta: future.scoreDelta,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error || "Could not apply this future")
        return
      }
      const summary = Array.isArray(json.actions) ? json.actions.join(" · ") : future.title
      toast.success(`Future applied: ${summary}`)
      onOpenChange(false)
      onApplied?.()
      window.dispatchEvent(new CustomEvent("finsight:refresh"))
    } catch {
      toast.error("Failed to apply decision future")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent suppressHydrationWarning className="sm:max-w-3xl rounded-3xl p-0 overflow-hidden border-border bg-card shadow-2xl">
        <DialogTitle className="sr-only">Financial Decision Futures Explorer</DialogTitle>
        <DialogDescription className="sr-only">Compare 4 financial decision futures and opportunity costs</DialogDescription>

        {/* Header */}
        <div className="bg-slate-950 px-6 py-5 text-white flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-8 items-center justify-center rounded-xl bg-teal-500/20 text-teal-400 ring-1 ring-teal-500/30">
              <SparklesIcon className="size-4.5" />
            </span>
            <h2 className="text-base font-semibold tracking-tight text-white">Financial Decision Futures Explorer</h2>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-medium text-slate-400">Decision Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-9 text-xs bg-slate-900 border-slate-800 text-white mt-1"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-400">Amount (INR)</label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="h-9 text-xs bg-slate-900 border-slate-800 text-white"
                />
                <Button size="sm" onClick={() => runAnalysis(title, amount)} className="h-9 px-4 text-xs shrink-0">
                  Analyze
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Analysis Body */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
              <SparklesIcon className="size-5 animate-spin mx-auto text-primary" />
              <p>Simulating 4 decision futures & opportunity cost vectors...</p>
            </div>
          ) : data ? (
            <>
              {/* Recommended Decision Banner */}
              <div className="rounded-2xl border border-teal-500/30 bg-teal-500/10 p-4 space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-teal-600 dark:text-teal-400">
                  <CheckCircle2Icon className="size-4" />
                  <span>RECOMMENDED VERDICT</span>
                </div>
                <p className="text-xs text-foreground font-medium">{data.why}</p>
              </div>

              {/* 4 Competing Futures Grid */}
              <div className="grid gap-3.5 sm:grid-cols-2">
                {data.futures.map((f) => {
                  const isRec = f.key === data.recommendedFutureKey
                  return (
                    <Card
                      key={f.key}
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                        isRec ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20" : "border-border/70 bg-card"
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold tracking-tight text-foreground">{f.title}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              f.scoreDelta >= 0 ? "bg-emerald-500/15 text-emerald-600" : "bg-rose-500/15 text-rose-600"
                            }`}
                          >
                            Score {f.scoreDelta >= 0 ? `+${f.scoreDelta}` : f.scoreDelta}
                          </span>
                        </div>

                        <p className="text-[11px] text-muted-foreground leading-relaxed">{f.description}</p>

                        <div className="pt-2 border-t border-border/50 space-y-1 text-[11px]">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Emergency Runway:</span>
                            <span className="font-semibold text-foreground">{f.emergencyMonthsLeft} months</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Liquid Cash Left:</span>
                            <span className="font-semibold text-foreground">₹{f.liquidCashLeft.toLocaleString("en-IN")}</span>
                          </div>
                        </div>

                        <div className="rounded-xl bg-muted/50 p-2.5 text-[11px] text-foreground/90 font-medium leading-relaxed">
                          💡 {f.opportunityCost}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        disabled={saving}
                        onClick={() => handleApplyFuture(f)}
                        variant={isRec ? "default" : "outline"}
                        className="w-full mt-3 h-8 text-xs gap-1 rounded-xl"
                      >
                        <span>{saving ? "Applying…" : "Apply Future"}</span>
                        <ArrowRightIcon className="size-3" />
                      </Button>
                    </Card>
                  )
                })}
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
