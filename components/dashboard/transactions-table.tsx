"use client"

import * as React from "react"
import { DownloadIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import type { TransactionDto } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatementUploadDialog } from "@/components/dashboard/statement-upload-dialog"

function fmtDate(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d
  return date.toLocaleDateString(undefined, { month: "short", day: "2-digit" })
}

export function TransactionsTable({
  transactions,
  onChanged,
}: {
  transactions: TransactionDto[]
  onChanged: () => void
}) {
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  async function onDelete(id: string) {
    setDeletingId(id)
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE", credentials: "include" })
    setDeletingId(null)

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data?.error || "Could not delete")
      return
    }
    toast.success("Deleted")
    onChanged()
  }

  function handleExportCsv() {
    window.open("/api/transactions/export", "_blank")
  }

  return (
    <Card className="rounded-2xl border-border bg-card p-4 shadow-premium sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold tracking-tight">Recent activity</div>
          <div className="text-xs text-muted-foreground">Income and expenses synced to your budget intelligence</div>
        </div>
        <div className="flex items-center gap-2">
          <StatementUploadDialog onUploaded={onChanged} />
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="rounded-xl flex items-center gap-1.5 text-xs"
          >
            <DownloadIcon className="size-3.5" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="hidden md:table-cell">Merchant</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-[70px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No transactions yet. Add one to unlock smarter insights.
                </TableCell>
              </TableRow>
            ) : (
              transactions.slice(0, 12).map((t) => {
                const isExpense = t.type === "expense"
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{fmtDate(t.occurredAt)}</TableCell>
                    <TableCell>{t.category}</TableCell>
                    <TableCell className="hidden md:table-cell">{t.merchant || "—"}</TableCell>
                    <TableCell className="text-right font-semibold">
                      <span className={isExpense ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}>
                        {isExpense ? "-" : "+"}₹{Math.round(t.amount).toLocaleString("en-IN")}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-2xl"
                        onClick={() => onDelete(t.id)}
                        disabled={deletingId === t.id}
                      >
                        <Trash2Icon className="size-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}
