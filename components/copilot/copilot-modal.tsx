"use client"

import * as React from "react"
import { BotIcon, CheckIcon, PlusIcon, SendIcon, SparklesIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

type ParsedTxn = {
  type: "expense" | "income"
  amount: number
  category: string
  merchant: string
  note: string
}

type Message = {
  id: string
  sender: "user" | "copilot"
  text: string
  toolUsed?: string
  parsedTransaction?: ParsedTxn
}

// Simple markdown line formatter for bold, headers, and bullet points
function FormattedMessageText({ text }: { text: string }) {
  const lines = text.split("\n")
  return (
    <div className="space-y-1 text-xs leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim()
        if (!trimmed) return <div key={idx} className="h-1" />

        // Header ###
        if (trimmed.startsWith("### ")) {
          return (
            <div key={idx} className="font-semibold text-sm tracking-tight text-foreground pt-1 pb-0.5">
              {trimmed.replace(/^###\s+/, "")}
            </div>
          )
        }

        // Bullet point •
        if (trimmed.startsWith("• ") || trimmed.startsWith("- ")) {
          const content = trimmed.replace(/^[•\-]\s+/, "")
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1">
              <span className="text-primary font-bold">•</span>
              <span>{renderBoldText(content)}</span>
            </div>
          )
        }

        return <div key={idx}>{renderBoldText(line)}</div>
      })}
    </div>
  )
}

function renderBoldText(str: string) {
  const parts = str.split(/(\*\*.*?\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return part
  })
}

export function CopilotModal() {
  const [open, setOpen] = React.useState(false)
  const [input, setInput] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [addedIds, setAddedIds] = React.useState<Record<string, boolean>>({})
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: "init",
      sender: "copilot",
      text: "### Welcome to FinSight AI Copilot\n\nI analyze your decisions using real-time financial math:\n• Ask **'Can I afford a ₹35,000 purchase?'**\n• Request **Health Score & Resilience** drivers\n• Paste **bank SMS or receipt text** to auto-log transactions.",
    },
  ])

  // Keyboard shortcut Cmd+K / Ctrl+K
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handleSend = async (customText?: string) => {
    const query = customText || input
    if (!query.trim() || loading) return

    const userMsg: Message = { id: String(Date.now()), sender: "user", text: query }
    setMessages((prev) => [...prev, userMsg])
    if (!customText) setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: query }),
      })

      const data = await res.json()
      if (res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: String(Date.now() + 1),
            sender: "copilot",
            text: data.reply || "Analysis complete.",
            toolUsed: data.toolUsed,
            parsedTransaction: data.parsedTransaction,
          },
        ])
      } else {
        toast.error(data.error || "Copilot failed to respond")
      }
    } catch {
      toast.error("Error communicating with Copilot")
    } finally {
      setLoading(false)
    }
  }

  const handleAddParsedToLedger = async (msgId: string, txn: ParsedTxn) => {
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: txn.type,
          amount: txn.amount,
          category: txn.category,
          merchant: txn.merchant,
          note: txn.note,
        }),
      })

      if (res.ok) {
        toast.success(`Added ₹${txn.amount} (${txn.merchant}) to ledger!`)
        setAddedIds((prev) => ({ ...prev, [msgId]: true }))
      } else {
        toast.error("Failed to add transaction")
      }
    } catch {
      toast.error("Error saving transaction")
    }
  }

  return (
    <>
      {/* Floating Launcher Button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full border border-primary/30 bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-xl transition-all hover:scale-105 active:scale-95"
      >
        <SparklesIcon className="size-4 animate-pulse" />
        <span>Ask Copilot</span>
        <span className="ml-1 rounded-md bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] text-primary-foreground/90 hidden sm:inline">
          ⌘K
        </span>
      </button>

      {/* Copilot Popup Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent suppressHydrationWarning className="sm:max-w-lg rounded-3xl p-0 overflow-hidden border-border bg-card shadow-2xl">
          <DialogTitle className="sr-only">FinSight AI Copilot</DialogTitle>
          <DialogDescription className="sr-only">Interactive financial decision copilot and receipt SMS parser</DialogDescription>
          {/* Executive Header */}
          <div className="flex items-center justify-between border-b border-border/60 bg-slate-950 px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-2xl bg-teal-500/20 text-teal-400 ring-1 ring-teal-500/30">
                <BotIcon className="size-5" />
              </div>
              <div>
                <div className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
                  <span>FinSight Copilot</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/30">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>Live AI Engine</span>
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">OpenRouter AI & Deterministic Decision Tools</div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl size-8 text-slate-300 hover:bg-slate-800 hover:text-white"
              onClick={() => setOpen(false)}
            >
              <XIcon className="size-4" />
            </Button>
          </div>

          {/* Quick Prompts Bar */}
          <div className="flex flex-wrap gap-1.5 bg-muted/30 px-4 py-2.5 border-b border-border/50">
            <button
              onClick={() => handleSend("Can I afford a ₹35,000 purchase this month?")}
              className="rounded-xl bg-background px-3 py-1.5 text-[11px] font-medium text-muted-foreground border border-border/70 shadow-xs hover:text-foreground hover:border-primary/40 transition-all"
            >
              💡 Can I afford ₹35k?
            </button>
            <button
              onClick={() => handleSend("Explain my financial health score drivers")}
              className="rounded-xl bg-background px-3 py-1.5 text-[11px] font-medium text-muted-foreground border border-border/70 shadow-xs hover:text-foreground hover:border-primary/40 transition-all"
            >
              📊 Explain Health Score
            </button>
            <button
              onClick={() => handleSend("Debited Rs 1450 at Swiggy via UPI on 10-Aug")}
              className="rounded-xl bg-background px-3 py-1.5 text-[11px] font-medium text-muted-foreground border border-border/70 shadow-xs hover:text-foreground hover:border-primary/40 transition-all"
            >
              📄 Parse Bank SMS
            </button>
          </div>

          {/* Messages Feed */}
          <div className="max-h-[360px] min-h-[240px] overflow-y-auto p-4 space-y-3.5 bg-slate-50/50 dark:bg-slate-950/20">
            {messages.map((m) => (
              <div key={m.id} className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-xs ${
                    m.sender === "user"
                      ? "bg-primary text-primary-foreground rounded-br-none font-medium text-xs"
                      : "bg-card text-foreground border border-border/60 rounded-bl-none shadow-sm"
                  }`}
                >
                  {m.toolUsed && (
                    <div className="mb-2 inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      <span>⚙️ Executed tool:</span>
                      <span className="font-mono">{m.toolUsed}</span>
                    </div>
                  )}

                  <FormattedMessageText text={m.text} />

                  {/* Parsed Transaction 1-Click Action Card */}
                  {m.parsedTransaction && m.parsedTransaction.amount > 0 && (
                    <Card className="mt-3 p-3 bg-muted/40 rounded-2xl border border-border/80 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span>{m.parsedTransaction.merchant || m.parsedTransaction.category}</span>
                        <span className={m.parsedTransaction.type === "expense" ? "text-destructive font-bold" : "text-emerald-600 font-bold"}>
                          {m.parsedTransaction.type === "expense" ? "-" : "+"}₹{m.parsedTransaction.amount}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground flex gap-2">
                        <span>Category: {m.parsedTransaction.category}</span>
                      </div>
                      <Button
                        size="sm"
                        disabled={addedIds[m.id]}
                        onClick={() => handleAddParsedToLedger(m.id, m.parsedTransaction!)}
                        className="w-full h-8 rounded-xl text-xs gap-1.5"
                      >
                        {addedIds[m.id] ? (
                          <>
                            <CheckIcon className="size-3.5 text-emerald-400" />
                            <span>Saved to Ledger</span>
                          </>
                        ) : (
                          <>
                            <PlusIcon className="size-3.5" />
                            <span>Add to Activity Ledger</span>
                          </>
                        )}
                      </Button>
                    </Card>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 rounded-xl bg-card border border-border/50 px-3.5 py-2.5 text-xs text-muted-foreground w-fit">
                <SparklesIcon className="size-4 animate-spin text-primary" />
                <span>Copilot is querying financial decision tools...</span>
              </div>
            )}
          </div>

          {/* Footer Input Bar */}
          <div className="border-t border-border/60 p-3 bg-card">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSend()
              }}
              className="flex items-center gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask decision question or paste bank SMS..."
                className="rounded-xl h-10 text-xs px-3.5 bg-background shadow-xs focus-visible:ring-primary"
              />
              <Button type="submit" disabled={!input.trim() || loading} size="sm" className="rounded-xl h-10 px-4">
                <SendIcon className="size-4" />
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
