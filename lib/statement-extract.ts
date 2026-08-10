import * as XLSX from "xlsx"

export type StatementFileKind = "pdf" | "csv" | "xls" | "xlsx" | "txt" | "unknown"

export function detectStatementKind(filename: string, mime?: string | null): StatementFileKind {
  const name = filename.toLowerCase()
  const type = (mime || "").toLowerCase()

  if (name.endsWith(".pdf") || type.includes("pdf")) return "pdf"
  if (name.endsWith(".xlsx") || type.includes("spreadsheetml")) return "xlsx"
  if (name.endsWith(".xls") || type === "application/vnd.ms-excel") return "xls"
  if (name.endsWith(".csv") || type.includes("csv")) return "csv"
  if (name.endsWith(".txt") || type.startsWith("text/")) return "txt"
  return "unknown"
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse")
  const parser = new PDFParse({ data: buffer })
  try {
    const result = await parser.getText()
    return String(result?.text || "")
  } finally {
    // pdf-parse v2 may keep worker resources; destroy if available
    const maybeDestroy = (parser as { destroy?: () => Promise<void> }).destroy
    if (typeof maybeDestroy === "function") {
      await maybeDestroy.call(parser).catch(() => undefined)
    }
  }
}

function extractSpreadsheetText(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true })
  const chunks: string[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue
    // Prefer CSV so the shared line parser can reuse CSV fallbacks
    chunks.push(XLSX.utils.sheet_to_csv(sheet))
  }

  return chunks.join("\n")
}

export async function extractStatementText(opts: {
  buffer: Buffer
  filename: string
  mime?: string | null
}): Promise<{ kind: StatementFileKind; text: string }> {
  const kind = detectStatementKind(opts.filename, opts.mime)

  if (kind === "pdf") {
    const text = await extractPdfText(opts.buffer)
    return { kind, text }
  }

  if (kind === "xls" || kind === "xlsx") {
    return { kind, text: extractSpreadsheetText(opts.buffer) }
  }

  if (kind === "csv" || kind === "txt") {
    return { kind, text: opts.buffer.toString("utf8") }
  }

  // Unknown: try UTF-8 text first, then PDF, then spreadsheet
  const asText = opts.buffer.toString("utf8")
  if (/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/.test(asText)) {
    return { kind: "txt", text: asText }
  }

  try {
    const text = await extractPdfText(opts.buffer)
    if (text.trim()) return { kind: "pdf", text }
  } catch {
    // ignore
  }

  try {
    const text = extractSpreadsheetText(opts.buffer)
    if (text.trim()) return { kind: "xlsx", text }
  } catch {
    // ignore
  }

  return { kind: "unknown", text: asText }
}
