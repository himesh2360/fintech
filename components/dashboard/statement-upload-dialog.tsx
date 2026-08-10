"use client"

import * as React from "react"
import { FileSpreadsheetIcon, FileTextIcon, UploadCloudIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { parseBankStatementText } from "@/lib/statement-parser"

type PreviewTxn = {
  date: string
  type: "expense" | "income"
  amount: number
  category: string
  merchant: string
  note?: string
}

const ACCEPTED_EXTENSIONS = ".pdf,.csv,.txt,.xls,.xlsx"
const ACCEPTED_LABEL = "PDF, CSV, XLS / XLSX, or plain text"

function isAcceptedFile(file: File) {
  const name = file.name.toLowerCase()
  return (
    name.endsWith(".pdf") ||
    name.endsWith(".csv") ||
    name.endsWith(".txt") ||
    name.endsWith(".xls") ||
    name.endsWith(".xlsx") ||
    file.type.includes("pdf") ||
    file.type.includes("csv") ||
    file.type.includes("sheet") ||
    file.type.includes("excel") ||
    file.type.startsWith("text/")
  )
}

export function StatementUploadDialog({ onUploaded }: { onUploaded?: () => void }) {
  const [open, setOpen] = React.useState(false)
  const [textInput, setTextInput] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [parsing, setParsing] = React.useState(false)
  const [previews, setPreviews] = React.useState<PreviewTxn[]>([])
  const [sourceLabel, setSourceLabel] = React.useState<string | null>(null)
  const [dragOver, setDragOver] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const resetState = () => {
    setTextInput("")
    setPreviews([])
    setSourceLabel(null)
    setParsing(false)
    setLoading(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const applyLocalTextPreview = (text: string) => {
    const items = parseBankStatementText(text).map((t) => ({
      date: String(t.date).slice(0, 10),
      type: t.type,
      amount: t.amount,
      category: t.category,
      merchant: t.merchant,
      note: t.note,
    }))
    setPreviews(items)
  }

  const parseUploadedFile = async (file: File) => {
    if (!isAcceptedFile(file)) {
      toast.error("Please upload a PDF, CSV, XLS, XLSX, or TXT bank statement")
      return
    }

    setParsing(true)
    setSourceLabel(file.name)

    try {
      const form = new FormData()
      form.append("file", file)
      form.append("preview", "true")

      const res = await fetch("/api/transactions/upload", {
        method: "POST",
        body: form,
        credentials: "include",
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Could not read this statement file")
        setPreviews([])
        return
      }

      const items = (data.transactions || []) as PreviewTxn[]
      setPreviews(items)
      setTextInput("") // binary sources don't need pasted text
      toast.success(`Parsed ${items.length} transactions from ${file.name}`)
    } catch {
      toast.error("Failed to parse statement file")
      setPreviews([])
    } finally {
      setParsing(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    void parseUploadedFile(file)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void parseUploadedFile(file)
  }

  const handleConfirmImport = async () => {
    if (previews.length === 0 && !textInput.trim()) return
    setLoading(true)

    try {
      const res = await fetch("/api/transactions/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          csvContent: textInput || undefined,
          transactions: previews.length > 0 ? previews : undefined,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        const dupMsg = data.duplicatesSkipped > 0 ? ` (${data.duplicatesSkipped} duplicates skipped)` : ""
        toast.success(`Imported ${data.count} new unique transactions${dupMsg}!`)
        setOpen(false)
        resetState()
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) resetState()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-2xl gap-1.5 h-9 text-xs">
          <UploadCloudIcon className="size-3.5" />
          <span>Upload Bank Statement</span>
        </Button>
      </DialogTrigger>

      <DialogContent
        suppressHydrationWarning
        className="sm:max-w-2xl rounded-3xl p-6 border-border bg-card shadow-2xl space-y-4"
      >
        <DialogTitle className="text-base font-bold flex items-center gap-2">
          <FileTextIcon className="size-4.5 text-primary" />
          <span>Universal Bank Statement & PDF Importer</span>
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          Upload PDF, CSV, or Excel statements — or paste raw text from HDFC, SBI, Kotak Mahindra, ICICI, or Axis.
        </DialogDescription>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`rounded-2xl border-2 border-dashed p-5 text-center space-y-2 transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-border/80 bg-muted/20"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            onChange={handleFileUpload}
            className="hidden"
            id="statement-file-input"
          />
          <label htmlFor="statement-file-input" className="cursor-pointer space-y-1 block">
            <UploadCloudIcon className="size-8 mx-auto text-muted-foreground" />
            <div className="text-xs font-semibold text-foreground">
              {parsing ? "Reading statement…" : "Click or drag PDF / CSV / XLS statement"}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Supports {ACCEPTED_LABEL} from HDFC, Kotak, SBI, ICICI, Axis
            </div>
            {sourceLabel && (
              <div className="pt-1 inline-flex items-center gap-1.5 text-[11px] font-medium text-primary">
                <FileSpreadsheetIcon className="size-3.5" />
                {sourceLabel}
              </div>
            )}
          </label>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">
            Or Paste PDF Statement Text / CSV Lines:
          </label>
          <Textarea
            rows={4}
            value={textInput}
            onChange={(e) => {
              const value = e.target.value
              setTextInput(value)
              setSourceLabel(null)
              applyLocalTextPreview(value)
            }}
            placeholder={
              "2026-05-12 UPI/TANVI DESHMUKH/TRANSFER KMB000001 454.37 0.00 51,546.38\n2026-05-11 NEFT CR-VENDOR SETTLEMENT S000001TXN 11,448.88 56,568.88"
            }
            className="rounded-xl text-xs font-mono"
          />
        </div>

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
                <div
                  key={`${p.date}-${p.merchant}-${idx}`}
                  className="flex items-center justify-between p-1.5 rounded-lg bg-background border border-border/40"
                >
                  <div className="truncate font-medium flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground font-mono">{p.date}</span>
                    <span>{p.merchant}</span>
                  </div>
                  <div className={`font-bold ${p.type === "expense" ? "text-rose-600" : "text-emerald-600"}`}>
                    {p.type === "expense" ? "-" : "+"}₹{p.amount.toLocaleString("en-IN")}
                  </div>
                </div>
              ))}
              {previews.length > 8 && (
                <div className="text-[10px] text-center text-muted-foreground pt-1">
                  + {previews.length - 8} more transactions extracted...
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOpen(false)
              resetState()
            }}
            className="rounded-xl text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={loading || parsing || (previews.length === 0 && !textInput.trim())}
            onClick={handleConfirmImport}
            className="rounded-xl text-xs gap-1.5 px-5"
          >
            {loading
              ? "Importing..."
              : parsing
                ? "Parsing..."
                : `Import ${previews.length} Transactions into Ledger`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
