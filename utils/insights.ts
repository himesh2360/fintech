export type InsightSeverity = "success" | "info" | "warning" | "danger"

export type Insight = {
  id: string
  severity: InsightSeverity
  title: string
  summary: string
  recommendation: string
  metric?: { label: string; value: string }
}

export type GenerateInsightsInput = {
  month: string
  budgetTotal: number
  expensesTotal: number
  incomeTotal: number
  creditLimit: number
  creditBalance: number
  spendByCategory: Record<string, number>
  prevSpendByCategory?: Record<string, number>
  transactions?: Array<{ merchant?: string; amount: number; category?: string }>
}

function pctChange(curr: number, prev: number) {
  if (prev <= 0 && curr <= 0) return 0
  if (prev <= 0) return 999
  return ((curr - prev) / prev) * 100
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export function generateInsights(input: GenerateInsightsInput): Insight[] {
  const insights: Insight[] = []

  const savings = input.incomeTotal - input.expensesTotal
  const savingsRate = input.incomeTotal > 0 ? savings / input.incomeTotal : 0

  const util = input.creditLimit > 0 ? input.creditBalance / input.creditLimit : 0
  const utilPct = Math.round(util * 100)

  if (input.budgetTotal > 0) {
    if (input.expensesTotal > input.budgetTotal) {
      const over = input.expensesTotal - input.budgetTotal
      insights.push({
        id: "overspend",
        severity: over > input.budgetTotal * 0.15 ? "danger" : "warning",
        title: "Overspending detected",
        summary: `You are over budget by ₹${Math.round(over).toLocaleString("en-IN")} this month.`,
        recommendation:
          "Freeze non-essential categories for 7 days. Move discretionary spending into one capped weekly bucket to stop bleed.",
        metric: { label: "Over budget", value: `₹${Math.round(over).toLocaleString("en-IN")}` },
      })
    } else {
      const remaining = input.budgetTotal - input.expensesTotal
      insights.push({
        id: "on-track",
        severity: "success",
        title: "Budget is on track",
        summary: `You still have ~₹${Math.round(remaining).toLocaleString("en-IN")} left in your monthly budget.`,
        recommendation: "Keep current pace. Consider moving the remaining budget into savings or a goal automatically.",
        metric: { label: "Remaining", value: `₹${Math.round(remaining).toLocaleString("en-IN")}` },
      })
    }
  }

  if (input.creditLimit > 0) {
    if (util >= 0.5) {
      insights.push({
        id: "credit-high",
        severity: "danger",
        title: "High credit utilization",
        summary: `Your credit utilization is ${utilPct}% — this can hurt your credit score.`,
        recommendation:
          "Aim for <30% utilization. Make an early payment mid-cycle or spread spending across multiple cards if available.",
        metric: { label: "Utilization", value: `${utilPct}%` },
      })
    } else if (util >= 0.3) {
      insights.push({
        id: "credit-medium",
        severity: "warning",
        title: "Credit utilization trending high",
        summary: `You're at ${utilPct}% utilization. Getting below 30% can improve your score.`,
        recommendation: "Pay down debt this week and keep utilization <30% before statement close.",
        metric: { label: "Utilization", value: `${utilPct}%` },
      })
    } else {
      insights.push({
        id: "credit-good",
        severity: "success",
        title: "Credit utilization looks healthy",
        summary: `Great — you're at ${utilPct}% utilization.`,
        recommendation: "Maintain this level. Keep autopay on, and review statements for subscription creep.",
        metric: { label: "Utilization", value: `${utilPct}%` },
      })
    }
  }

  // Category anomaly detection (rule-based).
  if (input.prevSpendByCategory) {
    const flagged = Object.entries(input.spendByCategory)
      .map(([cat, amt]) => ({ cat, amt, delta: pctChange(amt, input.prevSpendByCategory?.[cat] ?? 0) }))
      .filter((x) => x.amt >= 60 && x.delta >= 22)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 2)

    for (const f of flagged) {
      insights.push({
        id: `cat-${f.cat}`,
        severity: f.delta >= 60 ? "warning" : "info",
        title: `Spending spike: ${f.cat}`,
        summary: `You're spending ${Math.round(f.delta)}% more on ${f.cat} vs last month.`,
        recommendation: `Set a category cap for ${f.cat} and move any extra into a “cooldown” bucket for 48 hours before purchase.`,
        metric: { label: "Increase", value: `${Math.round(f.delta)}%` },
      })
    }
  }

  // Recurring subscription detection
  if (input.transactions && input.transactions.length > 0) {
    const merchantCounts: Record<string, { count: number; total: number }> = {}
    for (const t of input.transactions) {
      const name = (t.merchant || "").trim()
      if (name) {
        if (!merchantCounts[name]) merchantCounts[name] = { count: 0, total: 0 }
        merchantCounts[name].count++
        merchantCounts[name].total += t.amount
      }
    }

    const recurring = Object.entries(merchantCounts).filter(([, data]) => data.count >= 2)
    if (recurring.length > 0) {
      const topRecurring = recurring[0]
      insights.push({
        id: "recurring-subscriptions",
        severity: "info",
        title: "Recurring subscriptions detected",
        summary: `Detected recurring charges for ${topRecurring[0]} (₹${Math.round(topRecurring[1].total).toLocaleString("en-IN")}).`,
        recommendation: "Audit unused memberships monthly to prevent auto-renewal drain.",
        metric: { label: "Merchants", value: `${recurring.length} Active` },
      })
    }
  }

  // Savings guidance — only when there is real income activity
  if (input.incomeTotal > 0) {
    if (savingsRate < 0) {
      insights.push({
        id: "negative-savings",
        severity: "danger",
        title: "You’re spending more than you earn",
        summary: `Your cashflow is negative this month (–₹${Math.round(Math.abs(savings)).toLocaleString("en-IN")}).`,
        recommendation:
          "Immediately pause discretionary spending, renegotiate bills, and switch to a weekly envelope budget until cashflow turns positive.",
        metric: {
          label: "Cashflow",
          value: `–₹${Math.round(Math.abs(savings)).toLocaleString("en-IN")}`,
        },
      })
    } else if (savingsRate < 0.1) {
      insights.push({
        id: "low-savings",
        severity: "warning",
        title: "Savings rate is low",
        summary: `You're saving about ${Math.round(savingsRate * 100)}% of income.`,
        recommendation: "Try the 1% rule: reduce 1 small recurring expense and auto-save that amount weekly.",
        metric: { label: "Savings rate", value: `${Math.round(savingsRate * 100)}%` },
      })
    } else {
      insights.push({
        id: "good-savings",
        severity: "success",
        title: "Strong savings momentum",
        summary: `You're saving about ${Math.round(savingsRate * 100)}% of income.`,
        recommendation: "Consider routing part of this into an emergency fund goal, then a low-cost index investing plan.",
        metric: { label: "Savings rate", value: `${Math.round(savingsRate * 100)}%` },
      })
    }
  }

  // Forecast only when there are real expenses
  if (input.expensesTotal > 0) {
    const predicted = Math.round(input.expensesTotal * (1 + clamp(util - 0.25, 0, 0.25) * 0.15 + 0.03))
    insights.push({
      id: "prediction",
      severity: "info",
      title: "Next month expense forecast",
      summary: `Projected expenses next month: ~₹${predicted.toLocaleString("en-IN")}.`,
      recommendation:
        "If you want to beat the forecast, set a 72-hour rule for Shopping and cap Food/Delivery with a weekly plan.",
      metric: { label: "Forecast", value: `₹${predicted.toLocaleString("en-IN")}` },
    })
  }

  return insights
}

export async function generateInsightsWithAI(_input: GenerateInsightsInput): Promise<Insight[]> {
  void _input
  return []
}
