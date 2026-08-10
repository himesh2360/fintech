import { NextResponse } from "next/server"

import { dbConnect } from "@/lib/db"
import { isDemoUser } from "@/lib/demo"
import { seedDemoUserData } from "@/lib/demo-seed"
import { getAuthPayload } from "@/lib/request-auth"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const auth = getAuthPayload(req)
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Hard gate: never overwrite a real user's ledger with demo persona data
  if (!isDemoUser(auth.email)) {
    return NextResponse.json(
      { error: "Demo seed is only allowed for the demo account. Sign up stays empty until you add real data." },
      { status: 403 }
    )
  }

  await dbConnect()
  const month = await seedDemoUserData(auth.sub)

  return NextResponse.json({
    success: true,
    month,
    message: "Demo persona ('Rahul - Bangalore') loaded successfully!",
  })
}
