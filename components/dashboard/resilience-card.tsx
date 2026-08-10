"use client"

import * as React from "react"
import { AlertTriangleIcon, CheckCircle2Icon, ShieldCheckIcon, XCircleIcon } from "lucide-react"

import { Card } from "@/components/ui/card"

type Scenario = {
  id: string
  name: string
  description: string
  passed: boolean
  metric: string
  impact: string
}

type ResilienceData = {
  score: number
  label: "Fragile" | "Moderate" | "Resilient" | "Bulletproof"
  scenarios: Scenario[]
  vulnerabilities: string[]
  futureShock?: {
    detected: boolean
    message: string
    projectedSavingsPct: number
  }
}

export function ResilienceCard() {
  const [data, setData] = React.useState<ResilienceData | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetch("/api/decisions/stress-test")
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Card className="p-6 rounded-3xl animate-pulse space-y-4">
        <div className="h-5 w-48 bg-muted rounded-xl" />
        <div className="h-16 w-full bg-muted/60 rounded-2xl" />
      </Card>
    )
  }

  if (!data) return null

  const getLabelColor = (label: string) => {
    switch (label) {
      case "Bulletproof":
        return "text-emerald-600 bg-emerald-500/10 border-emerald-500/30"
      case "Resilient":
        return "text-teal-600 bg-teal-500/10 border-teal-500/30"
      case "Moderate":
        return "text-amber-600 bg-amber-500/10 border-amber-500/30"
      default:
        return "text-rose-600 bg-rose-500/10 border-rose-500/30"
    }
  }

  return (
    <Card className="p-5 sm:p-6 rounded-3xl border-border/80 bg-card shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheckIcon className="size-5.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-foreground">Financial Resilience Stress Test</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${getLabelColor(data.label)}`}>
                {data.label} ({data.score}/100)
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Evaluated against 4 real-world financial disruption shocks.
            </p>
          </div>
        </div>
      </div>

      {/* Future Shock Warning Alert */}
      {data.futureShock?.detected && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 flex items-start gap-3">
          <AlertTriangleIcon className="size-4.5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5 text-xs">
            <div className="font-semibold text-rose-600 dark:text-rose-400">Future Financial Shock Trajectory Detected</div>
            <div className="text-rose-900/90 dark:text-rose-200/90">{data.futureShock.message}</div>
          </div>
        </div>
      )}

      {/* 4 Shock Scenarios Grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {data.scenarios.map((s) => (
          <div
            key={s.id}
            className={`p-3.5 rounded-2xl border transition-all ${
              s.passed ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {s.passed ? (
                  <CheckCircle2Icon className="size-4 text-emerald-600" />
                ) : (
                  <XCircleIcon className="size-4 text-rose-600" />
                )}
                <span className="text-xs font-bold text-foreground">{s.name}</span>
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground">{s.metric}</span>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">{s.impact}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}
