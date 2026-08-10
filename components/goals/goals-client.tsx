"use client"

import * as React from "react"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"

type GoalDto = {
  id: string
  title: string
  targetAmount: number
  currentAmount: number
  deadline?: string | Date
  status: "active" | "completed" | "paused"
}

const CreateSchema = z.object({
  title: z.string().min(2).max(60),
  targetAmount: z.coerce.number().positive(),
})

type CreateFormValues = z.input<typeof CreateSchema>
type CreateParsedValues = z.output<typeof CreateSchema>

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store", credentials: "include" })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return (await res.json()) as T
}

export function GoalsClient() {
  const [goals, setGoals] = React.useState<GoalDto[]>([])
  const [loading, setLoading] = React.useState(true)
  const [open, setOpen] = React.useState(false)

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(CreateSchema),
    defaultValues: { title: "", targetAmount: 0 },
  })

  const refresh = React.useCallback(async () => {
    setLoading(true)
    try {
      const data = await getJson<{ goals: GoalDto[] }>("/api/goals")
      setGoals(data.goals)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load goals"
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  async function create(values: CreateFormValues) {
    const parsed: CreateParsedValues = CreateSchema.parse(values)
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data?.error || "Could not create goal")
      return
    }
    toast.success("Goal created")
    setOpen(false)
    form.reset({ title: "", targetAmount: 1000 })
    refresh()
  }

  async function addAmount(goalId: string, delta: number) {
    const g = goals.find((x) => x.id === goalId)
    if (!g) return
    const next = Math.max(0, g.currentAmount + delta)
    const res = await fetch(`/api/goals/${goalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentAmount: next,
        status: next >= g.targetAmount ? "completed" : g.status,
      }),
    })
    if (!res.ok) {
      toast.error("Could not update goal")
      return
    }
    refresh()
  }

  async function remove(goalId: string) {
    const res = await fetch(`/api/goals/${goalId}`, { method: "DELETE", credentials: "include" })
    if (!res.ok) {
      toast.error("Could not delete goal")
      return
    }
    toast.success("Goal deleted")
    refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs text-muted-foreground">FinSight</div>
          <h1 className="text-2xl font-semibold tracking-tight">Goal Tracker</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Turn savings into momentum with clear targets and progress.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-2xl">
              <PlusIcon className="mr-2 size-4" />
              New goal
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl">
            <DialogHeader>
              <DialogTitle>Create a goal</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(create)} className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input className="rounded-2xl" placeholder="Emergency Fund" {...form.register("title")} />
              </div>
              <div className="space-y-2">
                <Label>Target amount</Label>
                <Input type="number" className="rounded-2xl" {...form.register("targetAmount")} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" className="rounded-2xl" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="rounded-2xl" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Creating…" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <Card className="rounded-3xl p-6">Loading…</Card>
      ) : goals.length === 0 ? (
        <Card className="rounded-2xl border-border bg-card p-5 shadow-premium sm:p-6">
          <div className="text-sm font-semibold">No goals yet</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Create your first savings goal to unlock stronger recommendations.
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((g) => {
            const pct = g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0
            return (
              <Card key={g.id} className="rounded-2xl border-border bg-card p-4 shadow-premium sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold tracking-tight">{g.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      ₹{Math.round(g.currentAmount).toLocaleString("en-IN")} / ₹
                      {Math.round(g.targetAmount).toLocaleString("en-IN")} • {Math.round(pct)}%
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="rounded-2xl" onClick={() => remove(g.id)}>
                    <Trash2Icon className="size-4" />
                    <span className="sr-only">Delete goal</span>
                  </Button>
                </div>

                <div className="mt-4">
                  <Progress value={pct} className="h-2 rounded-full" />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="secondary" className="rounded-2xl" onClick={() => addAmount(g.id, 50)}>
                    +₹500
                  </Button>
                  <Button variant="secondary" className="rounded-2xl" onClick={() => addAmount(g.id, 100)}>
                    +₹1,000
                  </Button>
                  <Button variant="secondary" className="rounded-2xl" onClick={() => addAmount(g.id, 250)}>
                    +₹2,500
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

