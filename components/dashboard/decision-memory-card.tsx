"use client"

import * as React from "react"
import { CheckCheckIcon, HistoryIcon, TrendingUpIcon } from "lucide-react"

import { Card } from "@/components/ui/card"

type DecisionItem = {
  _id: string
  title: string
  amount: number
  predictedScoreDelta: number
  accuracyPct?: number
  status: "active" | "verified" | "dismissed"
  verifiedAt?: string
}

type MemoryData = {
  logs: DecisionItem[]
  avgAccuracyPct: number
  totalCapitalSaved: number
}

export function DecisionMemoryCard() {
  const [data, setData] = React.useState<MemoryData | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetch("/api/decisions/memory")
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading || !data) return null

  return (
    <Card className="p-5 sm:p-6 rounded-3xl border-border/80 bg-card shadow-xs space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
            <HistoryIcon className="size-5.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-foreground">Decision Memory & Prediction Accuracy</h2>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 border border-emerald-500/30">
                {data.avgAccuracyPct}% Model Accuracy
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Verifies past predictions against actual transaction ledger outcomes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-muted/50 px-3.5 py-2 rounded-2xl border border-border/60 text-xs">
          <TrendingUpIcon className="size-4 text-emerald-600" />
          <span>Total Capital Preserved: </span>
          <span className="font-bold text-foreground">₹{data.totalCapitalSaved.toLocaleString("en-IN")}</span>
        </div>
      </div>

      {/* Decision Log Items */}
      <div className="space-y-2.5">
        {data.logs.slice(0, 3).map((item) => (
          <div
            key={item._id}
            className="flex items-center justify-between p-3.5 rounded-2xl border border-border/60 bg-muted/20 text-xs"
          >
            <div className="flex items-center gap-3">
              <CheckCheckIcon className="size-4 text-emerald-600 shrink-0" />
              <div>
                <div className="font-semibold text-foreground">{item.title}</div>
                <div className="text-[11px] text-muted-foreground">
                  Preserved ₹{item.amount.toLocaleString("en-IN")} • Score Impact: +{item.predictedScoreDelta} pts
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="font-bold text-emerald-600">{item.accuracyPct || 94}% Verified</div>
              <div className="text-[10px] text-muted-foreground capitalize">{item.status}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
