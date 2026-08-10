/**
 * FinSight Core Knowledge Base & Rule Reference
 * Injectable system knowledge for AI Copilot grounding.
 */

export const FINSIGHT_KNOWLEDGE_BASE = {
  appName: "FinSight",
  tagline: "Financial Decision Intelligence Platform",
  corePhilosophy:
    "Decision support before action. Deterministic rules own all financial math (health scores, ranking, debt-vs-invest gating), while AI provides natural language explanation and scenario simulation without hallucinating numbers.",

  ruleEngineLogic: {
    healthScorecard: {
      maxScore: 100,
      driverWeights: {
        cashLiquidity: {
          weight: 0.3,
          target: "3 to 6 months of living expenses in liquid cash",
          formula: "Liquid Cash / Monthly Expenses",
          penalty: "Below 3 months incurs steep health score penalty.",
        },
        debtBurden: {
          weight: 0.35,
          target: "Zero high-interest debt (>9% p.a.)",
          rule: "High-interest debt is the #1 priority drag on financial health.",
        },
        creditUtilization: {
          weight: 0.2,
          target: "< 30% credit card balance utilization",
          penalty: "Utilization > 50% drops credit score driver to 0.",
        },
        budgetControl: {
          weight: 0.15,
          target: "> 20% monthly savings rate (Income vs Expenses)",
          formula: "(Income - Expenses) / Income",
        },
      },
    },

    gatedRules: [
      {
        id: "DEBT_BEFORE_INVEST",
        rule: "High-interest debt clearance MUST be completed before investing is allowed.",
        why: "Guaranteed 9-18% debt cost beats uncertain market investment returns.",
      },
      {
        id: "EMERGENCY_BUFFER_GUARD",
        rule: "Emergency cash buffer (3 months minimum) cannot be touched for discretionary purchases or investments.",
        why: "Prevents borrowing at high interest rates during unexpected income disruption.",
      },
      {
        id: "INVESTMENT_GATING",
        rule: "Invest suggestions API blocks mutual fund recommendations if Emergency Fund < 3 months OR High-Interest Debt > 0.",
        status: "GATED_STRICT",
      },
    ],

    stressTestShocks: [
      { id: "job_loss_3m", shock: "3-Month Job Loss (90 days zero income)" },
      { id: "medical_shock_50k", shock: "₹50,000 Out-of-pocket Medical Emergency" },
      { id: "income_cut_20pct", shock: "20% Income Cut / Salary Delay" },
      { id: "emi_rent_spike_15pct", shock: "15% Housing & EMI Inflation Spike" },
    ],

    tradeoffFutures: [
      { key: "BUY_NOW", logic: "Pay upfront from liquid cash today; evaluates emergency fund runway drop." },
      { key: "WAIT_3_MONTHS", logic: "Save 1/3 per month for 90 days; 0 emergency fund disruption." },
      { key: "INVEST_SURPLUS", logic: "Compound surplus in equity at 12% CAGR over 36 months." },
      { key: "CLEAR_DEBT", logic: "Pay down 9% debt; saves non-deductible interest expense." },
    ],
  },

  features: {
    financialDecisionTwin: "Simulates consequences of planned purchases, EMIs, or SIP increases across 4 futures.",
    decisionMemory: "Logs decisions, tracks predicted vs actual 30-60 day outcomes, and measures prediction accuracy.",
    smartReceiptParser: "Parses bank SMS and receipt text into structured transaction JSON for 1-click ledger saving.",
    pdfReportGenerator: "Executive 1-page financial summary PDF generator with KPI grids and risk callouts.",
  },
} as const
