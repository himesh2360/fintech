"use client"

import * as React from "react"
import { ArrowRightIcon, SlidersIcon, SparklesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { TradeoffModal } from "@/components/dashboard/tradeoff-modal"

export function ImpulseSliderCard({
  monthlyExpenses = 48000,
  cashBalance = 420000,
  baselineScore = 78,
}: {
  monthlyExpenses?: number
  cashBalance?: number
  baselineScore?: number
}) {
  const [amount, setAmount] = React.useState(45000)
  const [modalOpen, setModalOpen] = React.useState(false)

  // Real-time dynamic calculation
  const cashLeft = Math.max(0, cashBalance - amount)
  const efBaseline = Number((cashBalance / Math.max(1, monthlyExpenses)).toFixed(1))
  const efAfter = Number((cashLeft / Math.max(1, monthlyExpenses)).toFixed(1))

  // Score impact formula
  let scoreDelta = -2
  if (amount > 100000) scoreDelta = -22
  else if (amount > 60000) scoreDelta = -14
  else if (amount > 30000) scoreDelta = -8
  else if (amount > 15000) scoreDelta = -4

  const newScore = Math.max(0, baselineScore + scoreDelta)
  const investOpportunity = Math.round(amount * Math.pow(1.12, 3))

  return (
    <>
      <Card className="p-5 sm:p-6 rounded-3xl border-border/80 bg-gradient-to-br from-card via-card to-teal-500/5 shadow-xs space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <SlidersIcon className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-foreground">Live Purchase Impulse Simulator</h2>
                <span className="rounded-full bg-teal-500/10 px-2.5 py-0.5 text-[11px] font-bold text-teal-600 border border-teal-500/30">
                  Real-time Impact
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Drag the slider to test instant score & runway consequences before swiping.
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-muted-foreground">Target Purchase Amount</div>
            <div className="text-xl font-extrabold text-foreground tracking-tight">₹{amount.toLocaleString("en-IN")}</div>
          </div>
        </div>

        {/* Live Interactive Slider */}
        <div className="space-y-2 pt-1">
          <input
            type="range"
            min={5000}
            max={200000}
            step={5000}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full h-2.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
            <span>₹5,000</span>
            <span>₹50,000</span>
            <span>₹1,00,000</span>
            <span>₹2,00,000</span>
          </div>
        </div>

        {/* Dynamic Metric Cards */}
        <div className="grid gap-3 sm:grid-cols-3 pt-1">
          {/* Metric 1: Health Score Impact */}
          <div className="p-3.5 rounded-2xl border border-border/60 bg-background/80 space-y-1">
            <div className="text-[11px] text-muted-foreground font-medium">Health Score Move</div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-foreground">{baselineScore} ➔ {newScore}</span>
              <span className={`text-xs font-bold ${scoreDelta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                ({scoreDelta >= 0 ? `+${scoreDelta}` : scoreDelta} pts)
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">Immediate decision score impact</p>
          </div>

          {/* Metric 2: Emergency Runway Drop */}
          <div className="p-3.5 rounded-2xl border border-border/60 bg-background/80 space-y-1">
            <div className="text-[11px] text-muted-foreground font-medium">Emergency Runway</div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-foreground">{efBaseline} ➔ {efAfter} mo</span>
              {efAfter < 3 && <span className="text-[10px] font-bold text-rose-600">Below Floor</span>}
            </div>
            <p className="text-[10px] text-muted-foreground">Liquid cash safety floor (target: 6 mo)</p>
          </div>

          {/* Metric 3: 3-Year Opportunity Cost */}
          <div className="p-3.5 rounded-2xl border border-border/60 bg-background/80 space-y-1">
            <div className="text-[11px] text-muted-foreground font-medium">3-Yr Opportunity Cost</div>
            <div className="text-lg font-bold text-foreground">₹{investOpportunity.toLocaleString("en-IN")}</div>
            <p className="text-[10px] text-muted-foreground">Value if invested at 12% CAGR instead</p>
          </div>
        </div>

        {/* CTA to open full 4-future comparison */}
        <div className="flex justify-end pt-1">
          <Button onClick={() => setModalOpen(true)} size="sm" className="rounded-xl text-xs gap-1.5 h-9 px-4">
            <SparklesIcon className="size-3.5" />
            <span>Compare 4 Decision Futures</span>
            <ArrowRightIcon className="size-3.5" />
          </Button>
        </div>
      </Card>

      <TradeoffModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        presetTitle={`₹${amount.toLocaleString("en-IN")} Purchase`}
        presetAmount={amount}
      />
    </>
  )
}
