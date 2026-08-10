"use client"

import * as React from "react"
import { PlusIcon } from "lucide-react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { TransactionCategories } from "@/utils/categories"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const Schema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.coerce.number().positive(),
  category: z.enum(TransactionCategories),
  merchant: z.string().max(80).default(""),
  note: z.string().max(240).default(""),
})

type FormValues = z.input<typeof Schema>
type ParsedValues = z.output<typeof Schema>

export function TransactionDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = React.useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { type: "expense", amount: 0, category: "Food & Dining", merchant: "", note: "" },
  })

  async function onSubmit(values: FormValues) {
    const parsed: ParsedValues = Schema.parse(values)
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data?.error || "Could not add transaction")
      return
    }
    toast.success("Transaction added")
    setOpen(false)
    form.reset({ type: "expense", amount: 0, category: "Food & Dining", merchant: "", note: "" })
    onCreated()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-2xl">
          <PlusIcon className="mr-2 size-4" />
          Add transaction
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>Add a transaction</DialogTitle>
          <DialogDescription className="sr-only">Add a new income or expense transaction to your ledger</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="rounded-2xl">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" step="0.01" className="rounded-2xl" {...form.register("amount")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Controller
              control={form.control}
              name="category"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    {TransactionCategories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Merchant</Label>
              <Input className="rounded-2xl" placeholder="Merchant name" {...form.register("merchant")} />
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <Input className="rounded-2xl" placeholder="optional" {...form.register("note")} />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" className="rounded-2xl" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="rounded-2xl" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

