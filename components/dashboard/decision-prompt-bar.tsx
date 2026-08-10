"use client"

import * as React from "react"
import { CarIcon, CreditCardIcon, LaptopIcon, PlaneIcon, SparklesIcon, TrendingUpIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { TradeoffModal } from "@/components/dashboard/tradeoff-modal"

type Preset = {
  id: string
  label: string
  title: string
  amount: number
  icon: React.ReactNode
}

const PRESETS: Preset[] = [
  { id: "laptop", label: "Buy Laptop", title: "Buy ₹55,000 Work Laptop", amount: 55000, icon: <LaptopIcon className="size-3.5" /> },
  { id: "emi", label: "Take EMI", title: "Take ₹40,000 Credit EMI", amount: 40000, icon: <CreditCardIcon className="size-3.5" /> },
  { id: "vacation", label: "Plan Vacation", title: "Plan ₹35,000 Trip", amount: 35000, icon: <PlaneIcon className="size-3.5" /> },
  { id: "sip", label: "Increase SIP", title: "Increase Monthly SIP by ₹5,000", amount: 15000, icon: <TrendingUpIcon className="size-3.5" /> },
  { id: "bike", label: "Buy Vehicle", title: "Buy ₹1,20,000 Vehicle", amount: 120000, icon: <CarIcon className="size-3.5" /> },
]

export function DecisionPromptBar() {
  const [modalOpen, setModalOpen] = React.useState(false)
  const [activeTitle, setActiveTitle] = React.useState("Work Laptop Purchase")
  const [activeAmount, setActiveAmount] = React.useState(55000)

  const handleSelectPreset = (p: Preset) => {
    setActiveTitle(p.title)
    setActiveAmount(p.amount)
    setModalOpen(true)
  }

  return (
    <>
      <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-5 shadow-xs sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <SparklesIcon className="size-3.5 animate-pulse" />
              <span>Financial Decision Twin</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              What are you deciding today?
            </h1>
            <p className="text-xs text-muted-foreground">
              See the future of your financial decisions before you make them.
            </p>
          </div>

          <Button
            onClick={() => {
              setActiveTitle("Custom Purchase")
              setActiveAmount(30000)
              setModalOpen(true)
            }}
            className="rounded-2xl gap-2 shadow-sm text-xs h-10 px-5 shrink-0"
          >
            <SparklesIcon className="size-4" />
            <span>Simulate Custom Move</span>
          </Button>
        </div>

        {/* Quick Presets */}
        <div className="mt-4 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSelectPreset(p)}
              className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background px-3.5 py-2 text-xs font-medium text-foreground shadow-2xs hover:border-primary/50 hover:bg-muted/50 transition-all active:scale-95"
            >
              <span className="text-primary">{p.icon}</span>
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      <TradeoffModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        presetTitle={activeTitle}
        presetAmount={activeAmount}
      />
    </>
  )
}
