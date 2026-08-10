"use client"

import * as React from "react"
import Image from "next/image"
import { useTheme } from "next-themes"
import { motion } from "framer-motion"
import {
  ActivityIcon,
  BarChart3Icon,
  CoinsIcon,
  CompassIcon,
  LayoutDashboardIcon,
  ListOrderedIcon,
} from "lucide-react"
import { toast } from "sonner"

import type { DashboardSummary, DecisionsResponse, InsightsResponse, TransactionDto } from "@/types/api"
import { KpiCards } from "@/components/dashboard/kpi-cards"
import { RiskGauge } from "@/components/dashboard/risk-gauge"
import { SmartInsights } from "@/components/dashboard/smart-insights"
import { NotificationsPanel, type NotificationDto } from "@/components/dashboard/notifications-panel"
import { TransactionDialog } from "@/components/dashboard/transaction-dialog"
import { StatementUploadDialog } from "@/components/dashboard/statement-upload-dialog"
import { AgentTreasuryTab } from "@/components/dashboard/agent-treasury-tab"
import { TransactionsTable } from "@/components/dashboard/transactions-table"
import { BudgetCard } from "@/components/dashboard/budget-card"
import { AssetsLiabilitiesCard } from "@/components/dashboard/assets-liabilities-card"
import { PortfolioBreakdownCard } from "@/components/dashboard/portfolio-breakdown-card"
import { UPIPaymentsCard } from "@/components/dashboard/upi-payments-card"
import { TodaysMoves } from "@/components/dashboard/todays-moves"
import { HealthScorecardCard } from "@/components/dashboard/health-scorecard"
import { DecisionPromptBar } from "@/components/dashboard/decision-prompt-bar"
import { ResilienceCard } from "@/components/dashboard/resilience-card"
import { DecisionMemoryCard } from "@/components/dashboard/decision-memory-card"
import { DemoPersonaBanner } from "@/components/dashboard/demo-persona-banner"
import { ImpulseSliderCard } from "@/components/dashboard/impulse-slider-card"
import { RiskRadar } from "@/components/dashboard/risk-radar"
import { InvestSuggestionsCard } from "@/components/dashboard/invest-suggestions"
import { ScenarioSimulator } from "@/components/dashboard/scenario-simulator"
import { SectionLabel, MotionPanel, GridCell } from "@/components/dashboard/section-label"
import { ExpenseBreakdownPie } from "@/components/charts/expense-breakdown-pie"
import { IncomeExpenseBar } from "@/components/charts/income-expense-bar"
import { InvestmentGrowthLine } from "@/components/charts/investment-growth-line"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { monthKey } from "@/utils/time"

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store", credentials: "include" })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return (await res.json()) as T
}

export function DashboardClient() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [month] = React.useState(() => monthKey())
  const [tab, setTab] = React.useState("decide")
  const [summary, setSummary] = React.useState<DashboardSummary | null>(null)
  const [insights, setInsights] = React.useState<InsightsResponse | null>(null)
  const [decisions, setDecisions] = React.useState<DecisionsResponse | null>(null)
  const [transactions, setTransactions] = React.useState<TransactionDto[]>([])
  const [notifications, setNotifications] = React.useState<NotificationDto[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => setMounted(true), [])
  const isDark = mounted && resolvedTheme === "dark"

  const refresh = React.useCallback(async () => {
    setLoading(true)
    try {
      const [s, i, d, t, n] = await Promise.all([
        getJson<DashboardSummary>(`/api/dashboard/summary?month=${month}`),
        getJson<InsightsResponse>(`/api/insights?month=${month}`),
        getJson<DecisionsResponse>(`/api/decisions?month=${month}`),
        getJson<{ transactions: TransactionDto[] }>(`/api/transactions?from=${month}-01T00:00:00.000Z`),
        getJson<{ notifications: NotificationDto[] }>(`/api/notifications?month=${month}`),
      ])
      setSummary(s)
      setInsights(i)
      setDecisions(d)
      setTransactions(t.transactions)
      setNotifications(n.notifications)

      if (s.budget.remaining < 0) {
        toast.warning(
          `Overspending alert: you are ₹${Math.abs(s.budget.remaining).toLocaleString("en-IN")} over budget.`
        )
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load dashboard"
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [month])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  if (loading || !summary || !insights || !decisions) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-11 w-full max-w-xl rounded-xl" />
        <div className="grid gap-5 md:grid-cols-2">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    )
  }

  const healthScore = decisions.health.score
  const topMove = decisions.todaysMoves[0]

  return (
    <div className="w-full space-y-6">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "relative overflow-hidden rounded-2xl border border-border shadow-premium",
          isDark
            ? "bg-gradient-to-br from-card via-card to-primary/10"
            : "bg-gradient-to-br from-white via-card to-teal-50/80"
        )}
      >
        <Image
          src="/brand/icon-compass.svg"
          alt=""
          width={120}
          height={120}
          loading="eager"
          priority
          className={cn(
            "pointer-events-none absolute right-3 top-3 opacity-[0.1] sm:right-5 sm:top-4",
            isDark && "opacity-[0.16] invert"
          )}
        />
        <div className="relative grid gap-4 p-5 sm:gap-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center lg:p-7">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <CompassIcon className="size-3.5 shrink-0" />
              <span className="truncate">Decision workspace · {month}</span>
            </div>
            <h1 className="mt-3 font-display text-2xl tracking-tight text-foreground sm:text-3xl">
              What should you do now?
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              {decisions.isEmpty
                ? "Your account is empty. Add transactions, a budget, or a goal to unlock personalized moves."
                : topMove
                  ? `Top priority: ${topMove.title}. Health score ${healthScore}/100 (${decisions.health.label}).`
                  : "Ranked next steps from your full financial picture."}
            </p>
          </div>
          <div className="flex shrink-0 justify-start lg:justify-end items-center gap-2">
            <StatementUploadDialog onUploaded={refresh} />
            <TransactionDialog onCreated={refresh} />
          </div>
        </div>
      </motion.section>

      <Tabs value={tab} onValueChange={setTab} className="w-full gap-0">
        <div className="sticky top-[57px] z-30 -mx-1 mb-6 border-b border-border bg-background/95 px-1 pb-3 backdrop-blur-md sm:top-[61px]">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-muted p-1.5 sm:inline-flex sm:w-auto sm:grid-cols-none">
            <TabsTrigger value="decide" className="gap-1.5 rounded-lg px-3 py-2.5 text-xs sm:text-sm">
              <ListOrderedIcon className="size-3.5 shrink-0" />
              Decide
            </TabsTrigger>
            <TabsTrigger value="overview" className="gap-1.5 rounded-lg px-3 py-2.5 text-xs sm:text-sm">
              <LayoutDashboardIcon className="size-3.5 shrink-0" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5 rounded-lg px-3 py-2.5 text-xs sm:text-sm">
              <BarChart3Icon className="size-3.5 shrink-0" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1.5 rounded-lg px-3 py-2.5 text-xs sm:text-sm">
              <ActivityIcon className="size-3.5 shrink-0" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="treasury" className="gap-1.5 rounded-lg px-3 py-2.5 text-xs sm:text-sm bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold border border-teal-500/30">
              <CoinsIcon className="size-3.5 shrink-0" />
              <span>Agent Treasury (x402)</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* AGENT TREASURY (x402) */}
        <TabsContent value="treasury" className="mt-0 space-y-6 outline-none">
          <MotionPanel>
            <AgentTreasuryTab />
          </MotionPanel>
        </TabsContent>

        {/* DECIDE */}
        <TabsContent value="decide" className="mt-0 space-y-6 outline-none">
          <MotionPanel>
            <DemoPersonaBanner />
          </MotionPanel>

          <MotionPanel delay={0.02}>
            <DecisionPromptBar />
          </MotionPanel>

          <MotionPanel delay={0.03}>
            <ImpulseSliderCard
              monthlyExpenses={summary?.kpis?.monthlyExpenses ?? 0}
              cashBalance={summary?.assets?.cashBalance ?? 0}
              baselineScore={decisions?.health?.score ?? 0}
            />
          </MotionPanel>

          <MotionPanel delay={0.04}>
            <ResilienceCard />
          </MotionPanel>

          <div className="space-y-4">
            <SectionLabel
              icon={ListOrderedIcon}
              eyebrow="Priority lane"
              title="Decide first — charts later"
              subtitle="These moves are ranked by urgency and ₹ impact."
            />
            <MotionPanel delay={0.04}>
              <TodaysMoves moves={decisions.todaysMoves} disclaimer={decisions.disclaimer} />
            </MotionPanel>
          </div>

          <MotionPanel delay={0.06}>
            <DecisionMemoryCard />
          </MotionPanel>

          <div className="grid items-stretch gap-5 md:grid-cols-2">
            <GridCell>
              <MotionPanel delay={0.04} className="h-full">
                <HealthScorecardCard health={decisions.health} />
              </MotionPanel>
            </GridCell>
            <GridCell>
              <MotionPanel delay={0.08} className="h-full">
                <RiskRadar risks={decisions.risks} />
              </MotionPanel>
            </GridCell>
          </div>

          <div className="grid items-stretch gap-5 lg:grid-cols-2">
            <GridCell>
              <MotionPanel delay={0.1} className="h-full">
                <InvestSuggestionsCard invest={decisions.invest} />
              </MotionPanel>
            </GridCell>
            <GridCell>
              <MotionPanel delay={0.12} className="h-full">
                <ScenarioSimulator month={month} />
              </MotionPanel>
            </GridCell>
          </div>
        </TabsContent>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="mt-0 space-y-6 outline-none">
          <SectionLabel
            icon={LayoutDashboardIcon}
            eyebrow="Snapshot"
            title="Money at a glance"
            subtitle="Balances, cashflow, portfolio, and budget in one place."
          />
          <MotionPanel>
            <KpiCards
              healthScore={healthScore}
              totalBalance={summary.kpis.totalBalance}
              monthlyIncome={summary.kpis.monthlyIncome}
              monthlyExpenses={summary.kpis.monthlyExpenses}
            />
          </MotionPanel>
          <div className="grid items-stretch gap-5 md:grid-cols-2">
            <GridCell>
              <MotionPanel delay={0.05} className="h-full">
                <AssetsLiabilitiesCard
                  data={{
                    totalAssets: summary.assets.totalAssets,
                    cashBalance: summary.assets.cashBalance,
                    investments: summary.assets.investments,
                    creditLimit: summary.assets.creditLimit,
                    creditBalance: summary.assets.creditBalance,
                    netWorth: summary.assets.netWorth,
                  }}
                />
              </MotionPanel>
            </GridCell>
            <GridCell>
              <MotionPanel delay={0.08} className="h-full">
                <PortfolioBreakdownCard data={summary.portfolio} />
              </MotionPanel>
            </GridCell>
          </div>
          <div className="grid items-stretch gap-5 md:grid-cols-2">
            <GridCell>
              <MotionPanel delay={0.1} className="h-full">
                <UPIPaymentsCard data={summary.upi} />
              </MotionPanel>
            </GridCell>
            <GridCell>
              <MotionPanel delay={0.12} className="h-full">
                <BudgetCard
                  month={summary.month}
                  totalBudget={summary.budget.totalBudget}
                  remaining={summary.budget.remaining}
                  onUpdated={refresh}
                />
              </MotionPanel>
            </GridCell>
          </div>
        </TabsContent>

        {/* ANALYTICS */}
        <TabsContent value="analytics" className="mt-0 space-y-6 outline-none">
          <SectionLabel
            icon={BarChart3Icon}
            eyebrow="Evidence"
            title="Charts that support decisions"
            subtitle="Use these as proof behind Today’s moves — not as the product itself."
          />
          <div className="grid items-stretch gap-5 lg:grid-cols-3">
            <GridCell className="lg:col-span-2">
              <MotionPanel className="h-full">
                <Card className="flex h-full flex-col rounded-2xl border-border bg-card p-5 shadow-premium">
                  <div className="mb-1 text-sm font-semibold text-foreground">Expense Breakdown</div>
                  <div className="mb-3 text-xs text-muted-foreground">Where your money went this month</div>
                  <div className="min-h-[240px] flex-1">
                    <ExpenseBreakdownPie data={summary.charts.expenseBreakdown} />
                  </div>
                </Card>
              </MotionPanel>
            </GridCell>
            <GridCell>
              <MotionPanel delay={0.06} className="h-full">
                <Card className="flex h-full flex-col rounded-2xl border-border bg-card p-5 shadow-premium">
                  <div className="mb-1 text-sm font-semibold text-foreground">Risk Meter</div>
                  <div className="mb-3 text-xs text-muted-foreground">
                    {summary.isEmpty
                      ? "Add credit or spending data to score risk"
                      : `Utilization ${summary.risk.creditUtilization}% · Score ${summary.risk.riskScore}/100`}
                  </div>
                  <div className="flex flex-1 items-center justify-center">
                    <RiskGauge value={summary.risk.riskScore} empty={Boolean(summary.isEmpty)} />
                  </div>
                </Card>
              </MotionPanel>
            </GridCell>
          </div>
          <div className="grid items-stretch gap-5 md:grid-cols-2">
            <GridCell>
              <MotionPanel delay={0.08} className="h-full">
                <Card className="flex h-full flex-col rounded-2xl border-border bg-card p-5 shadow-premium">
                  <div className="mb-1 text-sm font-semibold text-foreground">Income vs Expenses</div>
                  <div className="mb-3 text-xs text-muted-foreground">Last 14 days activity</div>
                  <div className="min-h-[240px] flex-1">
                    <IncomeExpenseBar data={summary.charts.incomeVsExpenses} />
                  </div>
                </Card>
              </MotionPanel>
            </GridCell>
            <GridCell>
              <MotionPanel delay={0.1} className="h-full">
                <Card className="flex h-full flex-col rounded-2xl border-border bg-card p-5 shadow-premium">
                  <div className="mb-1 text-sm font-semibold text-foreground">Investment Growth</div>
                  <div className="mb-3 text-xs text-muted-foreground">
                    {summary.charts.investmentGrowth.length
                      ? "Projected from your current holdings (6 months)"
                      : "Appears after you add investments"}
                  </div>
                  <div className="min-h-[240px] flex-1">
                    <InvestmentGrowthLine data={summary.charts.investmentGrowth} />
                  </div>
                </Card>
              </MotionPanel>
            </GridCell>
          </div>
        </TabsContent>

        {/* ACTIVITY */}
        <TabsContent value="activity" className="mt-0 space-y-6 outline-none">
          <SectionLabel
            icon={ActivityIcon}
            eyebrow="Feed"
            title="Insights & transactions"
            subtitle="Alerts and ledger — keep your picture current."
          />
          <div className="grid items-stretch gap-5 md:grid-cols-2">
            <GridCell>
              <MotionPanel className="h-full">
                <SmartInsights insights={insights.insights} />
              </MotionPanel>
            </GridCell>
            <GridCell>
              <MotionPanel delay={0.06} className="h-full">
                <NotificationsPanel notifications={notifications} />
              </MotionPanel>
            </GridCell>
          </div>
          <MotionPanel delay={0.1}>
            <TransactionsTable transactions={transactions} onChanged={refresh} />
          </MotionPanel>
        </TabsContent>
      </Tabs>
    </div>
  )
}
