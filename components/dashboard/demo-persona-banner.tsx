"use client"

import * as React from "react"
import { RefreshCwIcon, UserCheckIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

export function DemoPersonaBanner({ onLoaded }: { onLoaded?: () => void }) {
  const [loading, setLoading] = React.useState(false)

  const handleLoadDemo = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/demo/seed", { method: "POST" })
      if (res.ok) {
        toast.success("Loaded Demo Story: Rahul in Bangalore (₹75k Income, ₹1.05L Debt, ₹4.2L Cash)")
        if (onLoaded) onLoaded()
        window.location.reload()
      } else {
        toast.error("Failed to load demo persona")
      }
    } catch {
      toast.error("Error seeding demo data")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-teal-500/30 bg-gradient-to-r from-teal-950/90 via-slate-900 to-slate-950 p-3.5 text-white shadow-sm flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-teal-500/20 text-teal-400 ring-1 ring-teal-500/30">
          <UserCheckIcon className="size-4.5" />
        </div>
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <span>Hackathon Demo Mode</span>
            <span className="rounded-full bg-teal-500/20 px-2 py-0.5 text-[10px] font-medium text-teal-300">
              Rahul (Bangalore Persona)
            </span>
          </div>
          <p className="text-[11px] text-slate-300">
            ₹75k Income • ₹1.05L Credit Card Debt (14%) • ₹4.2L Cash • Triggers All Engine Systems
          </p>
        </div>
      </div>

      <Button
        size="sm"
        disabled={loading}
        onClick={handleLoadDemo}
        className="rounded-xl h-8 text-xs gap-1.5 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold shrink-0"
      >
        <RefreshCwIcon className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
        <span>1-Click Load Demo Story</span>
      </Button>
    </div>
  )
}
