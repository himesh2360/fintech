import { NextResponse } from "next/server"

import { FINSIGHT_KNOWLEDGE_BASE } from "@/lib/knowledge-base"
import { loadFinancialProfile } from "@/lib/financial-context"
import { getAuthPayload } from "@/lib/request-auth"
import {
  buildHealthScorecard,
  runDecisionEngine,
  runFinancialStressTest,
  simulateScenario,
  type DecisionBundle,
  type FinancialProfile,
  type HealthScorecard,
  type StressTestResult,
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

  let type: "income" | "expense" = "expense"
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

function buildRichLocalInsight(opts: {
  health: HealthScorecard
  engineResult: DecisionBundle
  stress: StressTestResult
  profile: FinancialProfile
}): string {
  const { health, engineResult, stress, profile } = opts

  const drivers = health.drivers
    .map((d) => `• **${d.label}** — **${d.score}/100**: ${d.detail}`)
    .join("\n")

  const strengths = health.drivers
    .filter((d) => d.score >= 60)
    .map((d) => `• ${d.label} looks relatively solid at **${d.score}/100**`)

  const fixes = health.drivers
    .filter((d) => d.score < 60)
    .map((d) => `• Fix **${d.label}** (${d.score}/100): ${d.detail}`)

  const moves = engineResult.todaysMoves
    .slice(0, 3)
    .map((m, i) => `${i + 1}. **${m.title}** — ${m.why}\n   Impact: ${m.impact}`)
    .join("\n")

  const shocks = stress.scenarios
    .slice(0, 4)
    .map((s) => `• **${s.name}**: ${s.passed ? "Pass" : "Fail"} — ${s.impact}`)
    .join("\n")

  return `### Insight on your money right now

Your overall **Financial Health Score is ${health.score}/100 (${health.label})**.
Primary drag: **${health.topMover}**.

### Snapshot
• Income: **${fmtMoney(profile.monthlyIncome)}** / month
• Expenses: **${fmtMoney(profile.monthlyExpenses)}** / month
• Cash: **${fmtMoney(profile.cashBalance)}**
• High-interest debt: **${fmtMoney(profile.highInterestDebt)}**

### Score drivers
${drivers}

### 🟢 Strengths
${strengths.length ? strengths.join("\n") : "• No strong drivers yet — focus on emergency buffer and debt first."}

### 🔴 Areas to Fix
${fixes.length ? fixes.join("\n") : "• No major weak drivers detected."}

### Resilience check
• Resilience score: **${stress.score}/100 (${stress.label})**
${shocks}

### ⚡ Recommended Action
${moves || `• **${engineResult.todaysMoves[0]?.title || "Review cash buffer"}** — ${engineResult.todaysMoves[0]?.why || "Build a 3-month emergency fund before investing."}`}

Ask a follow-up like *"Can I afford a ₹40,000 purchase?"* or *"What if I cut spending by ₹5,000?"* for a scenario simulation.`
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

  const openaiKey = process.env.OPENAI_API_KEY?.trim()
  const openrouterKey = process.env.OPENROUTER_API_KEY?.trim()
  const useOpenAI = Boolean(openaiKey)
  const apiKey = useOpenAI ? openaiKey : openrouterKey
  const configuredModel = useOpenAI
    ? process.env.OPENAI_MODEL || "gpt-4o-mini"
    : process.env.OPENROUTER_MODEL || "openrouter/auto"
  const chatCompletionsUrl = useOpenAI
    ? "https://api.openai.com/v1/chat/completions"
    : "https://openrouter.ai/api/v1/chat/completions"
  const providerMode = useOpenAI ? "openai_api" : "openrouter_api"

  function authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    }
    if (!useOpenAI) {
      headers["HTTP-Referer"] =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.VERCEL_PROJECT_PRODUCTION_URL
          ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
          : process.env.RENDER_EXTERNAL_URL || "https://fintech-vtdj.onrender.com"
      headers["X-Title"] = "FinSight"
    }
    return headers
  }

  const snapshot = {
    healthScore: health.score,
    healthLabel: health.label,
    topMover: health.topMover,
    drivers: health.drivers.map((d) => ({ label: d.label, score: d.score, detail: d.detail })),
    income: fmtMoney(profile.monthlyIncome),
    expenses: fmtMoney(profile.monthlyExpenses),
    cash: fmtMoney(profile.cashBalance),
    debt: fmtMoney(profile.highInterestDebt),
    resilience: { score: stress.score, label: stress.label },
    todaysMoves: engineResult.todaysMoves.slice(0, 3).map((m) => ({
      title: m.title,
      why: m.why,
      impact: m.impact,
    })),
  }

  const systemPrompt = `You are FinSight AI Copilot — an elite personal private wealth advisor.
YOUR GOAL: Synthesize deterministic tool/engine results into a clear, useful answer. Never invent numbers.

SYSTEM KNOWLEDGE BASE & DECISION RULES:
${JSON.stringify(FINSIGHT_KNOWLEDGE_BASE, null, 2)}

LIVE USER SNAPSHOT (deterministic — treat as ground truth):
${JSON.stringify(snapshot, null, 2)}

STRICT FORMATTING & STYLE RULES:
1. NEVER output raw internal variable names (e.g. cutExpenseInr, extraEmiInr, extraInvestInr).
2. Format all amounts in Indian Rupee notation (e.g., ₹14,500, ₹1,05,000).
3. Structure your response with markdown:
   - Use '### Header' for sections.
   - Use '🟢 Strengths', '🔴 Areas to Fix', and '⚡ Recommended Action' subheaders.
   - Use bold text for key numbers and bullet points for readability.
4. When explaining health scores, detail EACH driver and the exact rupees/points drag.
5. Be direct, authoritative, and thorough (not a 3-bullet stub). Aim for a useful briefing.`

  const richLocal = buildRichLocalInsight({ health, engineResult, stress, profile })

  if (!apiKey) {
    return NextResponse.json({
      reply: richLocal,
      toolUsed: "get_health_scorecard",
      health,
      mode: "offline_rules",
    })
  }

  const candidateModels = useOpenAI
    ? Array.from(new Set([configuredModel, "gpt-4o-mini", "gpt-4o"]))
    : Array.from(
        new Set([
          configuredModel,
          "openrouter/auto",
          "meta-llama/llama-3.3-70b-instruct:free",
          "google/gemini-2.0-flash-exp:free",
        ])
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

  async function synthesizeFromToolData(
    model: string,
    toolName: string,
    toolResultData: unknown
  ): Promise<string | null> {
    // Avoid fragile OpenAI tool-roundtrip protocol; ask for a normal completion with grounded data.
    const res = await fetch(chatCompletionsUrl, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `${message}

I already ran deterministic tool "${toolName}" for you. Use ONLY this data (plus the live snapshot) and write a thorough FinSight-style briefing.

TOOL RESULT:
${JSON.stringify(toolResultData, null, 2)}`,
          },
        ],
      }),
    })

    if (!res.ok) return null
    const data = await res.json().catch(() => null)
    const content = data?.choices?.[0]?.message?.content
    return typeof content === "string" && content.trim() ? content : null
  }

  for (const currentModel of candidateModels) {
    try {
      const initialRes = await fetch(chatCompletionsUrl, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          model: currentModel,
          temperature: 0.4,
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
        } else {
          toolResultData = snapshot
        }

        const synthesized = await synthesizeFromToolData(currentModel, funcName, toolResultData)
        if (synthesized) {
          return NextResponse.json({
            reply: synthesized,
            toolUsed: funcName,
            parsedTransaction: parsedTxnResult,
            modelUsed: currentModel,
            mode: `${providerMode}_synthesis`,
          })
        }

        // Rich local briefing instead of the old 3-bullet stub
        return NextResponse.json({
          reply: richLocal,
          toolUsed: funcName,
          parsedTransaction: parsedTxnResult,
          modelUsed: currentModel,
          mode: `${providerMode}_local_synthesis`,
        })
      }

      if (assistantMsg?.content) {
        return NextResponse.json({
          reply: assistantMsg.content,
          modelUsed: currentModel,
          mode: providerMode,
        })
      }
    } catch {
      // try next model
    }
  }

  return NextResponse.json({
    reply: richLocal,
    toolUsed: "get_health_scorecard",
    health,
    mode: "offline_rules",
  })
}
