import { NextResponse } from "next/server"

import { loadFinancialProfile } from "@/lib/financial-context"
import { getAuthPayload } from "@/lib/request-auth"
import { runFinancialStressTest, detectFutureShock } from "@/utils/decision-engine"
import { monthKey } from "@/utils/time"

export const runtime = "nodejs"

export async function GET(req: Request) {
  const auth = getAuthPayload(req)
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const month = searchParams.get("month") || monthKey()

  const profile = await loadFinancialProfile(auth.sub, month)
  const stress = runFinancialStressTest(profile)
  const shock = detectFutureShock(profile)

  return NextResponse.json({
    ...stress,
    futureShock: shock,
  })
}
