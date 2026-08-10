/**
 * Canonical transaction categories used across the product (UI, importers,
 * copilot parser, demo seed, and decision engine).
 */
export const TransactionCategories = [
  "Food & Dining",
  "Utilities & Rent",
  "Shopping",
  "Transport",
  "Entertainment & Hobbies",
  "Health",
  "Education",
  "Travel",
  "Investments",
  "EMI",
  "Credit Card",
  "Income",
  "Other",
] as const

export type TransactionCategory = (typeof TransactionCategories)[number]

/** Credit categories map to the user's creditBalance rather than cashBalance. */
export function isCreditCategory(category: string): boolean {
  return category === "EMI" || category === "Credit Card"
}