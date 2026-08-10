import { NextResponse } from "next/server"

import { FINSIGHT_KNOWLEDGE_BASE } from "@/lib/knowledge-base"
import { loadFinancialProfile } from "@/lib/financial-context"
import { getAuthPayload } from "@/lib/request-auth"
import {
  buildHealthScorecard,
  runDecisionEngine,
  runFinancialStressTest,
  simulateScenario,
} from "@/utils/decision-engine"
import { monthKey } from "@/utils/time"

export const runtime = "nodejs"

type ToolCall = {
  id: string
  type: "function"
  function: {
    name: string
    arguments: string
  }
}

function fmtMoney(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`
}

function parseRawTransactionText(text: string) {
  const clean = text.trim()
  const amountMatch = clean.match(/(?:rs\.?|inr|₹|\$)\s*([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s*(?:rs|inr)/i)
  const amount = amountMatch ? parseFloat((amountMatch[1] || amountMatch[2]).replace(/,/g, "")) : 0

  let type: "expense" | "income" = "expense"
  if (/received|credited|salary|freelance|refund|deposit|got|income/i.test(clean)) {
    type = "income"
  }

  let category = "Other"
  if (/swiggy|zomato|uber|starbucks|food|dining|restaurant|pizza|cafe/i.test(clean)) {
    category = "Food & Dining"
  } else if (/rent|electricity|wifi|utility|bill|water|house/i.test(clean)) {
    category = "Utilities & Rent"
  } else if (/amazon|flipkart|shopping|clothes|store|myntra/i.test(clean)) {
    category = "Shopping"
  } else if (/movie|netflix|spotify|game|hobbies|entertainment/i.test(clean)) {
    category = "Entertainment & Hobbies"
  } else if (/bus|flight|cab|petrol|fuel|transport|ola/i.test(clean)) {
    category = "Transport"
  } else if (/emi|loan|credit card|card/i.test(clean)) {
    category = "EMI"
  }

  let merchant = ""
  const atMatch = clean.match(/(?:at|from|via|to)\s+([A-Za-z0-9\s&]+?)(?:\s+on|\s+via|\s+rs|\s+₹|\s+\d|$)/i)
  if (atMatch) merchant = atMatch[1].trim()

  return {
    type,
    amount,
    category,
    merchant: merchant || "Extracted Merchant",
    note: clean.slice(0, 100),
  }
}

export async function POST(req: Request) {
  const auth = getAuthPayload(req)
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { message, month = monthKey() } = body

  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Message string required" }, { status: 400 })
  }

  const profile = await loadFinancialProfile(auth.sub, month)
  const engineResult = runDecisionEngine(profile)
  const health = buildHealthScorecard(profile)
  const stress = runFinancialStressTest(profile)

  const apiKey = process.env.OPENROUTER_API_KEY
  const configuredModel = process.env.OPENROUTER_MODEL || "openrouter/auto"

  // System instructions with embedded FinSight Knowledge Base
  const systemPrompt = `You are FinSight AI Copilot — an elite personal private wealth advisor.
YOUR GOAL: Synthesize deterministic tool results and answer questions using FinSight's decision engine logic and rules.

SYSTEM KNOWLEDGE BASE & DECISION RULES:
${JSON.stringify(FINSIGHT_KNOWLEDGE_BASE, null, 2)}

STRICT FORMATTING & STYLE RULES:
1. NEVER output raw internal variable names (e.g. cutExpenseInr, extraEmiInr, extraInvestInr).
2. Format all amounts in Indian Rupee notation (e.g., ₹14,500, ₹1,05,000).
3. Structure your response with markdown:
   - Use '### Header' for sections.
   - Use '🟢 Strengths', '🔴 Areas to Fix', and '⚡ Recommended Action' subheaders.
   - Use bold text for key numbers and bullet points for readability.
4. When explaining health scores, detail EACH driver (Cash Liquidity, Debt Burden, Budget Control, Credit Utilization) and explain the exact rupees/points drag.
5. Be direct, authoritative, and concise.`

  // Offline / Fallback Mode (If API Key is missing or rate limited)
  if (!apiKey) {
    const textLower = message.toLowerCase()

    if (textLower.includes("parse") || textLower.includes("debited") || textLower.includes("credited") || textLower.includes("receipt") || textLower.includes("rs") || textLower.includes("₹")) {
      const parsed = parseRawTransactionText(message)
      return NextResponse.json({
        reply: `### Transaction Analysis\n\n• **Type**: ${parsed.type.toUpperCase()}\n• **Amount**: ${fmtMoney(parsed.amount)}\n• **Merchant**: ${parsed.merchant || parsed.category}\n• **Category**: ${parsed.category}`,
        toolUsed: "parse_transaction_input",
        parsedTransaction: parsed,
        mode: "offline_rules",
      })
    }

    if (textLower.includes("afford") || textLower.includes("buy") || textLower.includes("purchase") || textLower.includes("laptop") || textLower.includes("cost") || textLower.includes("what if")) {
      const numMatch = message.match(/[\d,]+/g)
      const testAmount = numMatch ? parseFloat(numMatch.join("").replace(/,/g, "")) : 25000

      const sim = simulateScenario(profile, { extraEmiInr: testAmount })
      const deltaText = sim.delta >= 0 ? `+${sim.delta} pts` : `${sim.delta} pts`

      return NextResponse.json({
        reply: `### Purchase Impact Simulation\n\nSimulating a **${fmtMoney(testAmount)}** expense impact:\n\n• **Health Score Impact**: Moves from **${sim.baselineScore} ➔ ${sim.projectedScore}** (${deltaText}).\n• **Emergency Runway**: Depletes liquid cash buffer.\n\n⚡ **Recommendation**: ${sim.notes?.[0] || "Review cash reserves before completing purchase."}`,
        toolUsed: "simulate_what_if_scenario",
        simulation: sim,
        mode: "offline_rules",
      })
    }

    // Rich Health Score Explanation
    const driversList = health.drivers
      .map((d) => `• **${d.label}** (${d.score}/100): ${d.detail}`)
      .join("\n")

    return NextResponse.json({
      reply: `### Financial Health Scorecard: ${health.score}/100 (${health.label})\n\nHere is what is driving your financial score right now:\n\n${driversList}\n\n🔴 **Primary Drag**: ${health.topMover}\n\n⚡ **Recommended Top Move**: "${engineResult.todaysMoves[0]?.title}" — ${engineResult.todaysMoves[0]?.why}`,
      toolUsed: "get_health_scorecard",
      health,
      mode: "offline_rules",
    })
  }

  // Model Candidates Queue
  const candidateModels = Array.from(
    new Set([configuredModel, "openrouter/auto", "meta-llama/llama-3.3-70b-instruct:free", "google/gemini-2.0-flash-exp:free"])
  )

  const toolsDef = [
    {
      type: "function",
      function: {
        name: "get_health_scorecard",
        description: "Retrieve comprehensive user financial health score, driver breakdown, and recommended top moves.",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "get_resilience_stress_test",
        description: "Retrieve financial resilience score and 4 real-world shock scenario pass/fail results.",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "simulate_what_if_scenario",
        description: "Simulate health score impact of an upcoming purchase, EMI, or investment amount.",
        parameters: {
          type: "object",
          properties: {
            purchaseAmount: { type: "number", description: "Planned expense or purchase amount" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "parse_transaction_input",
        description: "Parse raw receipt text or bank SMS into structured transaction data.",
        parameters: {
          type: "object",
          properties: {
            rawText: { type: "string" },
          },
          required: ["rawText"],
        },
      },
    },
  ]

  for (const currentModel of candidateModels) {
    try {
      // TURN 1: Initial call to OpenRouter
      const initialRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "FinSight",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: currentModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
          ],
          tools: toolsDef,
        }),
      })

      if (!initialRes.ok) continue

      const initialData = await initialRes.json()
      const assistantMsg = initialData?.choices?.[0]?.message

      // Handle Tool Call Execution
      if (assistantMsg?.tool_calls && assistantMsg.tool_calls.length > 0) {
        const toolCall: ToolCall = assistantMsg.tool_calls[0]
        const funcName = toolCall.function.name
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(toolCall.function.arguments || "{}")
        } catch {
          args = {}
        }

        let toolResultData: unknown = null
        let parsedTxnResult = null

        if (funcName === "get_health_scorecard") {
          toolResultData = {
            score: health.score,
            label: health.label,
            topMover: health.topMover,
            drivers: health.drivers.map((d) => ({ label: d.label, score: d.score, detail: d.detail })),
            topMoves: engineResult.todaysMoves.map((m) => ({ title: m.title, why: m.why, impact: m.impact })),
            profileSummary: {
              income: fmtMoney(profile.monthlyIncome),
              expenses: fmtMoney(profile.monthlyExpenses),
              cash: fmtMoney(profile.cashBalance),
              debt: fmtMoney(profile.highInterestDebt),
            },
          }
        } else if (funcName === "get_resilience_stress_test") {
          toolResultData = stress
        } else if (funcName === "simulate_what_if_scenario") {
          const amount = Number(args.purchaseAmount || 25000)
          toolResultData = simulateScenario(profile, { extraEmiInr: amount })
        } else if (funcName === "parse_transaction_input") {
          const rawText = String(args.rawText || message)
          parsedTxnResult = parseRawTransactionText(rawText)
          toolResultData = parsedTxnResult
        }

        // TURN 2: Send Tool Results back to OpenRouter for final natural synthesis!
        const followUpRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "FinSight",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: currentModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: message },
              assistantMsg,
              {
                role: "tool",
                tool_call_id: toolCall.id,
                content: JSON.stringify(toolResultData),
              },
            ],
          }),
        })

        if (followUpRes.ok) {
          const followUpData = await followUpRes.json()
          const finalContent = followUpData?.choices?.[0]?.message?.content

          if (finalContent) {
            return NextResponse.json({
              reply: finalContent,
              toolUsed: funcName,
              parsedTransaction: parsedTxnResult,
              modelUsed: currentModel,
              mode: "openrouter_api_synthesis",
            })
          }
        }

        // Fallback formatting if turn 2 fails
        return NextResponse.json({
          reply: `### Financial Analysis\n\n• **Health Score**: **${health.score}/100** (${health.label})\n• **Primary Drag**: ${health.topMover}\n• **Recommended Action**: "${engineResult.todaysMoves[0]?.title}"`,
          toolUsed: funcName,
          parsedTransaction: parsedTxnResult,
          mode: "openrouter_api",
        })
      }

      if (assistantMsg?.content) {
        return NextResponse.json({
          reply: assistantMsg.content,
          modelUsed: currentModel,
          mode: "openrouter_api",
        })
      }
    } catch {
      // try next model
    }
  }

  // Final fallback
  return NextResponse.json({
    reply: `### Financial Position Overview\n\n• **Health Score**: **${health.score}/100** (${health.label})\n• **Top Driver**: ${health.topMover}\n• **Recommended Move**: "${engineResult.todaysMoves[0]?.title}"`,
    toolUsed: "get_health_scorecard",
    health,
    mode: "offline_rules",
  })
}
