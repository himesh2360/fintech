"use client"

import * as React from "react"
import { FingerprintIcon, LinkIcon, ShieldAlertIcon, SlidersIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export function SettingsClient() {
  const [biometric, setBiometric] = React.useState(false)
  const [fraudSim, setFraudSim] = React.useState(false)
  const [linked, setLinked] = React.useState(false)

  // Decision preferences state
  const [savingsYieldPct, setSavingsYieldPct] = React.useState<number>(6.5)
  const [debtInterestPct, setDebtInterestPct] = React.useState<number>(9.0)
  const [emergencyMonthsTarget, setEmergencyMonthsTarget] = React.useState<number>(6)
  const [savingPreferences, setSavingPreferences] = React.useState(false)

  React.useEffect(() => {
    try {
      setBiometric(localStorage.getItem("finsight_bio") === "1")
      setFraudSim(localStorage.getItem("finsight_fraud") === "1")
      setLinked(localStorage.getItem("finsight_bank") === "1")
    } catch {
      // ignore
    }

    // Fetch user decision settings
    fetch("/api/user/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          setSavingsYieldPct(data.settings.savingsYieldPct ?? 6.5)
          setDebtInterestPct(data.settings.debtInterestPct ?? 9.0)
          setEmergencyMonthsTarget(data.settings.emergencyMonthsTarget ?? 6)
        }
      })
      .catch(() => {})
  }, [])

  React.useEffect(() => {
    try {
      localStorage.setItem("finsight_bio", biometric ? "1" : "0")
      localStorage.setItem("finsight_fraud", fraudSim ? "1" : "0")
      localStorage.setItem("finsight_bank", linked ? "1" : "0")
    } catch {
      // ignore
    }
  }, [biometric, fraudSim, linked])

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingPreferences(true)

    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          savingsYieldPct,
          debtInterestPct,
          emergencyMonthsTarget,
        }),
      })

      if (res.ok) {
        toast.success("Decision engine preferences updated!")
      } else {
        toast.error("Failed to save settings.")
      }
    } catch {
      toast.error("Error saving decision preferences.")
    } finally {
      setSavingPreferences(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-muted-foreground">FinSight</div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Security, integrations, and decision engine parameters.</p>
      </div>

      <Card className="rounded-2xl border-border bg-card p-4 shadow-premium sm:p-5">
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <div className="flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <SlidersIcon className="size-5" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">Decision Engine Parameters</div>
            <div className="text-xs text-muted-foreground">Tune interest rates & risk thresholds</div>
          </div>
        </div>

        <form onSubmit={handleSavePreferences} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="debtInterest" className="text-xs font-medium">
                Debt Interest Rate (%)
              </Label>
              <Input
                id="debtInterest"
                type="number"
                step="0.1"
                min="0"
                max="50"
                value={debtInterestPct}
                onChange={(e) => setDebtInterestPct(parseFloat(e.target.value) || 0)}
                className="rounded-xl"
              />
              <p className="text-[11px] text-muted-foreground">Used for interest arbitrage & risk score</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="savingsYield" className="text-xs font-medium">
                Savings Account Yield (%)
              </Label>
              <Input
                id="savingsYield"
                type="number"
                step="0.1"
                min="0"
                max="30"
                value={savingsYieldPct}
                onChange={(e) => setSavingsYieldPct(parseFloat(e.target.value) || 0)}
                className="rounded-xl"
              />
              <p className="text-[11px] text-muted-foreground">Expected baseline yield on cash</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="emergencyTarget" className="text-xs font-medium">
                Emergency Target (Months)
              </Label>
              <Input
                id="emergencyTarget"
                type="number"
                min="1"
                max="24"
                value={emergencyMonthsTarget}
                onChange={(e) => setEmergencyMonthsTarget(parseInt(e.target.value) || 1)}
                className="rounded-xl"
              />
              <p className="text-[11px] text-muted-foreground">Target months of expense buffer</p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={savingPreferences} className="rounded-xl">
              {savingPreferences ? "Saving..." : "Save Preferences"}
            </Button>
          </div>
        </form>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border-border bg-card p-4 shadow-premium sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <FingerprintIcon className="size-5" />
              </div>
              <div>
                <div className="text-sm font-semibold tracking-tight">Biometric login (UI mock)</div>
                <div className="text-xs text-muted-foreground">Pitch-ready security polish</div>
              </div>
            </div>
            <Switch checked={biometric} onCheckedChange={setBiometric} />
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            Enable FaceID/Fingerprint UI flows for demos. Authentication remains JWT-based for local development.
          </div>
        </Card>

        <Card className="rounded-2xl border-border bg-card p-4 shadow-premium sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ShieldAlertIcon className="size-5" />
              </div>
              <div>
                <div className="text-sm font-semibold tracking-tight">Fraud detection simulation</div>
                <div className="text-xs text-muted-foreground">Smart alerts demo</div>
              </div>
            </div>
            <Switch checked={fraudSim} onCheckedChange={setFraudSim} />
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            When enabled, FinSight will flag unusually large transactions and show “Potential fraud” alerts.
          </div>
        </Card>
      </div>

      <Card className="rounded-2xl border-border bg-card p-4 shadow-premium sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <LinkIcon className="size-5" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">Bank linking (safe mock)</div>
              <div className="text-xs text-muted-foreground">No real credentials needed</div>
            </div>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button className="rounded-2xl" variant={linked ? "secondary" : "default"}>
                {linked ? "Manage connection" : "Link bank"}
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl">
              <DialogHeader>
                <DialogTitle>Link a bank account (mock)</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  This is a hackathon-safe simulation of a Plaid-style flow. No credentials are collected, stored, or
                  transmitted.
                </p>
                <div className="rounded-2xl border border-border/70 p-4">
                  <div className="font-semibold text-foreground">Supported providers</div>
                  <div className="mt-1">Plaid • Finicity • MX</div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    className="rounded-2xl"
                    onClick={() => {
                      setLinked(false)
                      toast.message("Bank unlinked (mock).")
                    }}
                  >
                    Unlink
                  </Button>
                  <Button
                    className="rounded-2xl"
                    onClick={() => {
                      setLinked(true)
                      toast.success("Bank linked (mock).")
                    }}
                  >
                    Link (mock)
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mt-4 text-sm text-muted-foreground">
          Status:{" "}
          <span className={linked ? "font-semibold text-emerald-600 dark:text-emerald-400" : "font-semibold"}>
            {linked ? "Connected" : "Not connected"}
          </span>
        </div>
      </Card>
    </div>
  )
}
