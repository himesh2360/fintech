"use client"

import * as React from "react"
import { FileTextIcon, UploadCloudIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

type PreviewTxn = {
  date: string
  type: "expense" | "income"
  amount: number
  category: string
  merchant: string
}

function parseCategoryFromDesc(desc: string, isIncome: boolean): string {
  if (isIncome) return "Income"
  const d = desc.toLowerCase()
  if (/swiggy|zomato|starbucks|food|dining|restaurant|pizza|cafe|instamart|blinkit|dhaba|cafeteria/i.test(d)) return "Food & Dining"
  if (/rent|electricity|wifi|jiofiber|airtel|bill|utility|bses|uppcl|broadband|hostel/i.test(d)) return "Utilities & Rent"
  if (/amazon|flipkart|ajio|croma|decathlon|myntra|dmart|shopping|nykaa|hardware|stationery/i.test(d)) return "Shopping"
  if (/netflix|spotify|bookmyshow|pvr|movie|entertainment/i.test(d)) return "Entertainment & Hobbies"
  if (/ola|uber|rapido|irctc|petrol|fuel|transport|pmpml/i.test(d)) return "Transport"
  if (/sip|mutual fund|axis bluechip|invest/i.test(d)) return "Investments"
  if (/emi|credit card|hdfc cc|loan|lic premium|tuition fee|college/i.test(d)) return "EMI"
  return "Other"
}

function parseUniversalBankLine(line: string): PreviewTxn | null {
  const trimmed = line.trim()
  const dateMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\s+/)
  if (!dateMatch) return null

  const rawDate = dateMatch[1]
  const rest = trimmed.slice(dateMatch[0].length).trim()
  const tokens = rest.split(/\s+/)
  if (tokens.length < 3) return null

  const balanceStr = tokens[tokens.length - 1].replace(/,/g, "")
  if (isNaN(parseFloat(balanceStr))) return null

  let amount = 0
  let isDeposit = false
  let descTokensEnd = tokens.length - 1

  const tLast2 = tokens[tokens.length - 2]?.replace(/,/g, "")
  const tLast3 = tokens[tokens.length - 3]?.replace(/,/g, "")

  const num2 = parseFloat(tLast2)
  const num3 = parseFloat(tLast3)

  if (!isNaN(num2) && !isNaN(num3)) {
    if (num2 > 0) {
      amount = num2
      isDeposit = true
    } else if (num3 > 0) {
      amount = num3
      isDeposit = false
    }
    descTokensEnd = tokens.length - 3
  } else if (!isNaN(num2) && num2 > 0) {
    amount = num2
    isDeposit = /NEFT CR|CREDIT|DEPOSIT|SALARY|ALLOWANCE|CASHBACK|VENDOR SETTLEMENT/i.test(trimmed)
    descTokensEnd = tokens.length - 2
  }

  if (amount <= 0) return null

  let desc = tokens.slice(0, descTokensEnd).join(" ")
  desc = desc.replace(/\s+[A-Z0-9]{8,15}$/i, "")

  const category = parseCategoryFromDesc(desc, isDeposit)
  const merchant = desc.replace(/^(UPI-|POS-|NEFT CR-|ATM WDL-|ATM CASH WDL )/i, "").trim()

  return {
    date: rawDate,
    type: isDeposit ? "income" : "expense",
    amount,
    category,
    merchant: merchant || "Statement Merchant",
  }
}

export function StatementUploadDialog({ onUploaded }: { onUploaded?: () => void }) {
  const [open, setOpen] = React.useState(false)
  const [textInput, setTextInput] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [previews, setPreviews] = React.useState<PreviewTxn[]>([])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      const content = evt.target?.result as string
      setTextInput(content)
      parseLocalText(content)
    }
    reader.readAsText(file)
  }

  const parseLocalText = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
    const items: PreviewTxn[] = []

    for (const line of lines) {
      const parsedLine = parseUniversalBankLine(line)
      if (parsedLine) {
        items.push(parsedLine)
        continue
      }

      // CSV Split Fallback
      const parts = line.trim().split(/,|\t/).map((p) => p.trim().replace(/^["']|["']$/g, ""))
      if (parts.length >= 2) {
        let amount = 0
        let merchant = ""

        for (const p of parts) {
          const num = parseFloat(p.replace(/[^\d.-]/g, ""))
          if (!isNaN(num) && num !== 0 && amount === 0) {
            amount = Math.abs(num)
          } else if (p.length > 2 && !merchant) {
            merchant = p
          }
        }

        if (amount > 0) {
          const isIncome = /credited|salary|refund|deposit/i.test(line)
          items.push({
            date: new Date().toISOString().slice(0, 10),
            type: isIncome ? "income" : "expense",
            amount,
            category: parseCategoryFromDesc(merchant || line, isIncome),
            merchant: merchant || "Statement Transaction",
          })
        }
      }
    }

    setPreviews(items)
  }

  const handleConfirmImport = async () => {
    if (previews.length === 0 && !textInput.trim()) return
    setLoading(true)

    try {
      const res = await fetch("/api/transactions/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvContent: textInput,
          transactions: previews.length > 0 ? previews : undefined,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        const dupMsg = data.duplicatesSkipped > 0 ? ` (${data.duplicatesSkipped} duplicates skipped)` : ""
        toast.success(`Imported ${data.count} new unique transactions${dupMsg}!`)
        setOpen(false)
        setPreviews([])
        setTextInput("")
        if (onUploaded) onUploaded()
        window.location.reload()
      } else {
        toast.error(data.error || "Failed to import statement")
      }
    } catch {
      toast.error("Error connecting to upload endpoint")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-2xl gap-1.5 h-9 text-xs">
          <UploadCloudIcon className="size-3.5" />
          <span>Upload Bank Statement</span>
        </Button>
      </DialogTrigger>

      <DialogContent suppressHydrationWarning className="sm:max-w-2xl rounded-3xl p-6 border-border bg-card shadow-2xl space-y-4">
        <DialogTitle className="text-base font-bold flex items-center gap-2">
          <FileTextIcon className="size-4.5 text-primary" />
          <span>Universal Bank Statement & PDF Importer</span>
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          Supports CSV files or raw text copy-pasted from HDFC, SBI, Kotak Mahindra, or Axis Bank PDF statements.
        </DialogDescription>

        {/* Drag & Drop Zone */}
        <div className="rounded-2xl border-2 border-dashed border-border/80 p-5 text-center bg-muted/20 space-y-2">
          <input
            type="file"
            accept=".csv,.txt"
            onChange={handleFileUpload}
            className="hidden"
            id="statement-file-input"
          />
          <label htmlFor="statement-file-input" className="cursor-pointer space-y-1 block">
            <UploadCloudIcon className="size-8 mx-auto text-muted-foreground" />
            <div className="text-xs font-semibold text-foreground">Click to select CSV/Text Bank Statement</div>
            <div className="text-[11px] text-muted-foreground">Supports HDFC, Kotak, SBI, ICICI, Axis CSV & plain text dumps</div>
          </label>
        </div>

        {/* Raw Text Input */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">Or Paste PDF Statement Text / CSV Lines:</label>
          <Textarea
            rows={4}
            value={textInput}
            onChange={(e) => {
              setTextInput(e.target.value)
              parseLocalText(e.target.value)
            }}
            placeholder="2026-05-12 UPI/TANVI DESHMUKH/TRANSFER KMB000001 454.37 0.00 51,546.38&#10;2026-05-11 NEFT CR-VENDOR SETTLEMENT S000001TXN 11,448.88 56,568.88"
            className="rounded-xl text-xs font-mono"
          />
        </div>

        {/* Extracted Preview List */}
        {previews.length > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span>Extracted Preview ({previews.length} transactions)</span>
              <span className="text-emerald-600 font-bold">
                Total: ₹{previews.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString("en-IN")}
              </span>
            </div>

            <div className="max-h-40 overflow-y-auto rounded-xl border border-border/60 p-2 space-y-1 bg-muted/10 text-xs">
              {previews.slice(0, 8).map((p, idx) => (
                <div key={idx} className="flex items-center justify-between p-1.5 rounded-lg bg-background border border-border/40">
                  <div className="truncate font-medium flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground font-mono">{p.date}</span>
                    <span>{p.merchant}</span>
                  </div>
                  <div className={`font-bold ${p.type === "expense" ? "text-rose-600" : "text-emerald-600"}`}>
                    {p.type === "expense" ? "-" : "+"}₹{p.amount}
                  </div>
                </div>
              ))}
              {previews.length > 5 && (
                <div className="text-[10px] text-center text-muted-foreground pt-1">
                  + {previews.length - 8} more transactions extracted...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Confirm Action Button */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="rounded-xl text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={loading || (previews.length === 0 && !textInput.trim())}
            onClick={handleConfirmImport}
            className="rounded-xl text-xs gap-1.5 px-5"
          >
            {loading ? "Importing..." : `Import ${previews.length} Transactions into Ledger`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
