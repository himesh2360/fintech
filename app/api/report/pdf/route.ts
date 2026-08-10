import { NextResponse } from "next/server"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

import { dbConnect } from "@/lib/db"
import { getAuthPayload } from "@/lib/request-auth"
import { Budget } from "@/models/Budget"
import { Transaction } from "@/models/Transaction"
import { User } from "@/models/User"
import { endOfMonth, monthKey, startOfMonth } from "@/utils/time"
import { generateInsights } from "@/utils/insights"

export const runtime = "nodejs"

function cleanPdfText(text: string): string {
  if (!text) return ""
  return text.replace(/₹/g, "INR ").replace(/[^\x00-\x7F]/g, "")
}

function fmtPdfAmount(amount: number): string {
  return `INR ${Math.round(amount).toLocaleString("en-IN")}`
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(" ")
  const lines: string[] = []
  let currentLine = ""

  for (const word of words) {
    if ((currentLine + " " + word).trim().length <= maxChars) {
      currentLine = (currentLine + " " + word).trim()
    } else {
      if (currentLine) lines.push(currentLine)
      currentLine = word
    }
  }
  if (currentLine) lines.push(currentLine)
  return lines
}

export async function GET(req: Request) {
  const auth = getAuthPayload(req)
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const month = url.searchParams.get("month") ?? monthKey()
  const [yearStr, monthStr] = month.split("-")
  const monthDate = new Date(Number(yearStr), Number(monthStr) - 1, 1)
  const from = startOfMonth(monthDate)
  const to = endOfMonth(monthDate)

  await dbConnect()
  const [user, budget, txns] = await Promise.all([
    User.findById(auth.sub).lean(),
    Budget.findOne({ userId: auth.sub, month }).lean(),
    Transaction.find({ userId: auth.sub, occurredAt: { $gte: from, $lte: to } })
      .sort({ occurredAt: -1 })
      .limit(10)
      .lean(),
  ])

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const incomeTotal = txns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0)
  const expensesTotal = txns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)

  const spendByCategory: Record<string, number> = {}
  for (const t of txns) {
    if (t.type !== "expense") continue
    spendByCategory[t.category] = (spendByCategory[t.category] ?? 0) + t.amount
  }

  const budgetTotal = budget?.totalBudget ?? 0
  const insights =
    incomeTotal > 0 || expensesTotal > 0 || budgetTotal > 0
      ? generateInsights({
          month,
          budgetTotal,
          incomeTotal,
          expensesTotal,
          creditLimit: user.creditLimit ?? 0,
          creditBalance: user.creditBalance ?? 0,
          spendByCategory,
        }).slice(0, 3)
      : []

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89]) // A4 Page Size
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const left = 40
  const right = 555
  const contentWidth = right - left

  // --- BRAND HEADER BANNER ---
  page.drawRectangle({
    x: 0,
    y: 765,
    width: 595.28,
    height: 76.89,
    color: rgb(0.08, 0.12, 0.28), // Deep Navy Indigo
  })

  page.drawText("FINSIGHT", {
    x: left,
    y: 808,
    size: 20,
    font: bold,
    color: rgb(1, 1, 1),
  })

  page.drawText("FINANCIAL INTELLIGENCE REPORT", {
    x: left,
    y: 792,
    size: 8.5,
    font,
    color: rgb(0.65, 0.75, 0.95),
  })

  // Header Right Metadata Box
  page.drawText(cleanPdfText(`REPORT PERIOD: ${month}`), {
    x: right - 160,
    y: 808,
    size: 9,
    font: bold,
    color: rgb(1, 1, 1),
  })
  page.drawText(cleanPdfText(`USER: ${user.name}`), {
    x: right - 160,
    y: 793,
    size: 8.5,
    font,
    color: rgb(0.85, 0.9, 0.98),
  })

  let y = 735

  // --- EXECUTIVE SUMMARY SECTION TITLE ---
  page.drawRectangle({
    x: left,
    y: y - 2,
    width: 4,
    height: 14,
    color: rgb(0.15, 0.45, 0.92),
  })
  page.drawText("EXECUTIVE FINANCIAL SUMMARY", {
    x: left + 12,
    y: y,
    size: 11,
    font: bold,
    color: rgb(0.12, 0.16, 0.28),
  })

  y -= 24

  // --- KPI METRIC CARDS GRID (2x2) ---
  const creditUtilPct =
    (user.creditLimit ?? 0) > 0
      ? Math.round(((user.creditBalance ?? 0) / (user.creditLimit ?? 1)) * 100)
      : 0

  const kpis = [
    { label: "MONTHLY INCOME", value: fmtPdfAmount(incomeTotal), color: rgb(0.08, 0.65, 0.35) },
    { label: "MONTHLY EXPENSES", value: fmtPdfAmount(expensesTotal), color: rgb(0.88, 0.22, 0.35) },
    { label: "TOTAL BUDGET", value: fmtPdfAmount(budgetTotal), color: rgb(0.15, 0.45, 0.92) },
    { label: "CREDIT UTILIZATION", value: `${creditUtilPct}%`, color: rgb(0.85, 0.52, 0.15) },
  ]

  const boxW = (contentWidth - 15) / 2
  const boxH = 50

  for (let i = 0; i < kpis.length; i++) {
    const col = i % 2
    const row = Math.floor(i / 2)
    const bx = left + col * (boxW + 15)
    const by = y - row * (boxH + 12) - boxH

    // Background Card
    page.drawRectangle({
      x: bx,
      y: by,
      width: boxW,
      height: boxH,
      color: rgb(0.97, 0.98, 0.99),
      borderColor: rgb(0.88, 0.9, 0.94),
      borderWidth: 1,
    })

    // Left Color Accent Strip
    page.drawRectangle({
      x: bx,
      y: by,
      width: 4,
      height: boxH,
      color: kpis[i].color,
    })

    // Label
    page.drawText(kpis[i].label, {
      x: bx + 12,
      y: by + boxH - 16,
      size: 8,
      font: bold,
      color: rgb(0.4, 0.45, 0.52),
    })

    // Value
    page.drawText(cleanPdfText(kpis[i].value), {
      x: bx + 12,
      y: by + 12,
      size: 13,
      font: bold,
      color: rgb(0.12, 0.16, 0.28),
    })
  }

  y -= 2 * boxH + 34

  // --- SMART DECISION INSIGHTS SECTION ---
  page.drawRectangle({
    x: left,
    y: y - 2,
    width: 4,
    height: 14,
    color: rgb(0.15, 0.45, 0.92),
  })
  page.drawText("SMART DECISION INSIGHTS", {
    x: left + 12,
    y: y,
    size: 11,
    font: bold,
    color: rgb(0.12, 0.16, 0.28),
  })

  y -= 20

  if (insights.length === 0) {
    page.drawText("No insight alerts generated for this billing period.", {
      x: left,
      y,
      size: 9.5,
      font,
      color: rgb(0.5, 0.5, 0.55),
    })
    y -= 20
  } else {
    for (const item of insights) {
      const severityColor =
        item.severity === "danger"
          ? rgb(0.88, 0.22, 0.35)
          : item.severity === "warning"
            ? rgb(0.85, 0.52, 0.15)
            : item.severity === "success"
              ? rgb(0.08, 0.65, 0.35)
              : rgb(0.15, 0.45, 0.92)

      const titleClean = cleanPdfText(item.title)
      const summaryClean = cleanPdfText(item.summary)
      const wrappedSummary = wrapText(summaryClean, 82)

      const cardH = 26 + wrappedSummary.length * 12

      // Insight background card
      page.drawRectangle({
        x: left,
        y: y - cardH,
        width: contentWidth,
        height: cardH,
        color: rgb(0.98, 0.985, 0.995),
        borderColor: rgb(0.9, 0.92, 0.95),
        borderWidth: 1,
      })

      // Left Accent Strip
      page.drawRectangle({
        x: left,
        y: y - cardH,
        width: 3.5,
        height: cardH,
        color: severityColor,
      })

      // Title Line
      page.drawText(`[${item.severity.toUpperCase()}] ${titleClean}`, {
        x: left + 10,
        y: y - 14,
        size: 9,
        font: bold,
        color: severityColor,
      })

      // Wrapped Summary Lines
      let textY = y - 26
      for (const line of wrappedSummary) {
        page.drawText(line, {
          x: left + 10,
          y: textY,
          size: 8.5,
          font,
          color: rgb(0.2, 0.24, 0.32),
        })
        textY -= 12
      }

      y -= cardH + 10
    }
  }

  y -= 10

  // --- RECENT TRANSACTIONS TABLE SECTION ---
  page.drawRectangle({
    x: left,
    y: y - 2,
    width: 4,
    height: 14,
    color: rgb(0.15, 0.45, 0.92),
  })
  page.drawText("RECENT ACTIVITY LEDGER", {
    x: left + 12,
    y: y,
    size: 11,
    font: bold,
    color: rgb(0.12, 0.16, 0.28),
  })

  y -= 20

  // Dark Table Header Bar
  page.drawRectangle({
    x: left,
    y: y - 18,
    width: contentWidth,
    height: 20,
    color: rgb(0.12, 0.16, 0.28),
  })

  const headers = ["DATE", "CATEGORY", "MERCHANT", "TYPE", "AMOUNT"]
  const colX = [left + 8, left + 85, left + 215, left + 365, left + 445]

  headers.forEach((h, idx) => {
    page.drawText(h, {
      x: colX[idx],
      y: y - 13,
      size: 8,
      font: bold,
      color: rgb(1, 1, 1),
    })
  })

  y -= 20

  if (txns.length === 0) {
    page.drawText("No recorded transactions found for this month.", {
      x: left + 8,
      y: y - 14,
      size: 9,
      font,
      color: rgb(0.5, 0.5, 0.55),
    })
  } else {
    for (let i = 0; i < txns.length; i++) {
      const t = txns[i]
      const rowBg = i % 2 === 0 ? rgb(1, 1, 1) : rgb(0.96, 0.97, 0.99)

      page.drawRectangle({
        x: left,
        y: y - 16,
        width: contentWidth,
        height: 18,
        color: rowBg,
        borderColor: rgb(0.92, 0.93, 0.96),
        borderWidth: 0.5,
      })

      const dateStr = new Date(t.occurredAt).toISOString().slice(0, 10)
      const isExpense = t.type === "expense"
      const amtStr = `${isExpense ? "-" : "+"}INR ${Math.round(t.amount).toLocaleString("en-IN")}`
      const amtColor = isExpense ? rgb(0.85, 0.2, 0.3) : rgb(0.08, 0.65, 0.35)

      page.drawText(dateStr, { x: colX[0], y: y - 12, size: 8.5, font, color: rgb(0.2, 0.24, 0.32) })
      page.drawText(cleanPdfText(String(t.category)).slice(0, 20), { x: colX[1], y: y - 12, size: 8.5, font, color: rgb(0.2, 0.24, 0.32) })
      page.drawText(cleanPdfText(String(t.merchant || "—")).slice(0, 22), { x: colX[2], y: y - 12, size: 8.5, font, color: rgb(0.2, 0.24, 0.32) })
      page.drawText(String(t.type), { x: colX[3], y: y - 12, size: 8.5, font, color: rgb(0.4, 0.45, 0.52) })
      page.drawText(cleanPdfText(amtStr), { x: colX[4], y: y - 12, size: 8.5, font: bold, color: amtColor })

      y -= 18
      if (y < 50) break
    }
  }

  // --- FOOTER BANNER ---
  page.drawLine({
    start: { x: left, y: 35 },
    end: { x: right, y: 35 },
    thickness: 0.8,
    color: rgb(0.85, 0.88, 0.92),
  })

  page.drawText("FinSight Decision Support  •  Confidential Financial Intelligence Report", {
    x: left,
    y: 22,
    size: 7.5,
    font,
    color: rgb(0.5, 0.55, 0.62),
  })

  page.drawText("Page 1 of 1", {
    x: right - 40,
    y: 22,
    size: 7.5,
    font,
    color: rgb(0.5, 0.55, 0.62),
  })

  const bytes = await pdf.save()
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="finsight-report-${month}.pdf"`,
    },
  })
}
