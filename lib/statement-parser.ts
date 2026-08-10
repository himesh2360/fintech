export type ParsedStatementTxn = {
  date: string
  type: "income" | "expense"
  amount: number
  category: string
  merchant: string
  note?: string
}

export function parseCategoryFromDesc(desc: string, isIncome: boolean): string {
  if (isIncome) return "Income"
  const d = desc.toLowerCase()
  if (/swiggy|zomato|starbucks|food|dining|restaurant|pizza|cafe|instamart|blinkit|dhaba|cafeteria/i.test(d))
    return "Food & Dining"
  if (/rent|electricity|wifi|jiofiber|airtel|bill|utility|bses|uppcl|broadband|hostel/i.test(d))
    return "Utilities & Rent"
  if (/amazon|flipkart|ajio|croma|decathlon|myntra|dmart|shopping|nykaa|hardware|stationery/i.test(d))
    return "Shopping"
  if (/netflix|spotify|bookmyshow|pvr|movie|entertainment|cult\.fit|gym/i.test(d))
    return "Entertainment & Hobbies"
  if (/ola|uber|rapido|irctc|petrol|fuel|transport|pmpml|auto/i.test(d)) return "Transport"
  if (/sip|mutual fund|axis bluechip|invest/i.test(d)) return "Investments"
  if (/emi|credit card|hdfc cc|loan|lic premium|tuition fee|college|atm/i.test(d)) return "EMI"
  return "Other"
}

/** Returns YYYY-MM-DD (calendar date, no timezone shift). */
function normalizeDateOnly(raw: string): string | null {
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const slash = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (slash) return `${slash[3]}-${slash[2]}-${slash[1]}`
  return null
}

export function toOccurredAt(dateOnly: string): Date {
  const [y, m, d] = dateOnly.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
}

function parseMoneyToken(token: string): number | null {
  const cleaned = token.replace(/,/g, "").trim()
  if (!cleaned || cleaned === "-" || cleaned === "—" || cleaned === "–") return 0
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

function isJunkStatementLine(line: string): boolean {
  return /^(date|txn date|description|narration|transaction details|account|holder|number|ifsc|branch|opening|closing|statement|period|currency|balance|ref no|chq)/i.test(
    line.trim()
  ) || /\b(opening balance|closing balance|account holder|statement period)\b/i.test(line)
}

/**
 * Parses one bank-statement line from PDF text dumps / space-delimited exports.
 * Supports HDFC, Kotak, SBI-style: Date | Narration | Ref | Withdrawal | Deposit | Balance
 */
export function parseUniversalBankLine(line: string): ParsedStatementTxn | null {
  const trimmed = line.trim()
  if (!trimmed || isJunkStatementLine(trimmed)) return null

  const dateMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\s+/)
  if (!dateMatch) return null

  const dateOnly = normalizeDateOnly(dateMatch[1])
  if (!dateOnly) return null

  const rest = trimmed.slice(dateMatch[0].length).trim()
  const tokens = rest.split(/\s+/).filter(Boolean)
  if (tokens.length < 2) return null

  let balance: number | null = null
  let deposit: number | null = null
  let withdrawal: number | null = null
  let consumed = 0

  for (let i = tokens.length - 1; i >= 0 && consumed < 3; i--) {
    const val = parseMoneyToken(tokens[i])
    if (val === null) break
    if (consumed === 0) balance = val
    else if (consumed === 1) deposit = val
    else withdrawal = val
    consumed++
  }

  let amount = 0
  let isDeposit = false
  const descEnd = tokens.length - consumed

  if (consumed >= 3 && withdrawal !== null && deposit !== null) {
    if (deposit > 0 && withdrawal === 0) {
      amount = deposit
      isDeposit = true
    } else if (withdrawal > 0) {
      amount = withdrawal
      isDeposit = false
    } else if (deposit > 0) {
      amount = deposit
      isDeposit = true
    }
  } else if (consumed === 2 && deposit !== null && balance !== null) {
    const narrationProbe = tokens.slice(0, descEnd).join(" ")
    isDeposit = /NEFT CR|CREDIT|DEPOSIT|SALARY|ALLOWANCE|CASHBACK|VENDOR SETTLEMENT|REFUND/i.test(
      `${trimmed} ${narrationProbe}`
    )
    amount = deposit
  }

  if (amount <= 0) return null

  let desc = tokens.slice(0, Math.max(0, descEnd)).join(" ")
  desc = desc.replace(/\s+[A-Z0-9]{6,20}$/i, "").trim()

  const category = parseCategoryFromDesc(desc || trimmed, isDeposit)
  const merchant =
    desc.replace(/^(UPI[-/]|POS[-/]|NEFT CR-|ATM WDL-|ATM CASH WDL\s*)/i, "").trim() ||
    "Statement Merchant"

  return {
    date: dateOnly,
    type: isDeposit ? "income" : "expense",
    amount,
    category,
    merchant,
    note: desc || trimmed.slice(0, 120),
  }
}

function parseCsvOrTabularLine(line: string): ParsedStatementTxn | null {
  const trimmed = line.trim()
  if (!trimmed || isJunkStatementLine(trimmed)) return null
  // Avoid treating "Rs. 52,000.75" balance fragments as CSV rows
  if (/^rs\.?\s*[\d,]+/i.test(trimmed)) return null

  const parts = trimmed.split(/,|\t/).map((p) => p.trim().replace(/^["']|["']$/g, ""))
  if (parts.length < 3) return null
  if (/^date$/i.test(parts[0]) || /^txn\s*date$/i.test(parts[0])) return null

  const dateOnly = normalizeDateOnly(parts[0])
  if (!dateOnly) return null

  const merchant = parts[1] || "CSV Import"

  // Standard export: Date, Narration, Ref, Withdrawal, Deposit, Balance
  let withdrawal = 0
  let deposit = 0

  if (parts.length >= 6) {
    withdrawal = parseMoneyToken(parts[3]) ?? 0
    deposit = parseMoneyToken(parts[4]) ?? 0
  } else if (parts.length === 5) {
    // Date, Narration, Withdrawal, Deposit, Balance
    withdrawal = parseMoneyToken(parts[2]) ?? 0
    deposit = parseMoneyToken(parts[3]) ?? 0
  } else {
    // Date, Narration, Amount[, ...]
    for (let i = 2; i < parts.length; i++) {
      const n = parseMoneyToken(parts[i])
      if (n !== null && n > 0) {
        if (/credit|deposit|income|neft cr|cashback/i.test(trimmed)) deposit = n
        else withdrawal = n
        break
      }
    }
  }

  let amount = 0
  let isIncome = false
  if (deposit > 0 && withdrawal === 0) {
    amount = deposit
    isIncome = true
  } else if (withdrawal > 0) {
    amount = withdrawal
    isIncome = false
  } else if (deposit > 0) {
    amount = deposit
    isIncome = true
  }

  if (amount <= 0) return null

  return {
    date: dateOnly,
    type: isIncome ? "income" : "expense",
    amount,
    category: parseCategoryFromDesc(merchant, isIncome),
    merchant,
    note: trimmed.slice(0, 120),
  }
}

export function parseBankStatementText(content: string): ParsedStatementTxn[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0)
  const txns: ParsedStatementTxn[] = []
  const seen = new Set<string>()

  for (const line of lines) {
    const parsedLine = parseUniversalBankLine(line) || parseCsvOrTabularLine(line)
    if (!parsedLine) continue

    const key = `${parsedLine.date}_${parsedLine.type}_${parsedLine.amount.toFixed(2)}_${parsedLine.merchant.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    txns.push(parsedLine)
  }

  return txns
}
