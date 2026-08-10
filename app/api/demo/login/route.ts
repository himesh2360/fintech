import { NextResponse } from "next/server"

import { dbConnect } from "@/lib/db"
import { AUTH_COOKIE_NAME, authCookieOptions, hashPassword, signAuthToken } from "@/lib/auth"
import { demoEmail } from "@/lib/demo"
import { seedDemoUserData } from "@/lib/demo-seed"
import { User } from "@/models/User"

export const runtime = "nodejs"

export async function POST() {
  await dbConnect()
  const email = demoEmail()
  const password = process.env.DEMO_PASSWORD || "demo12345"

  let user = await User.findOne({ email })
  if (!user) {
    user = await User.create({
      name: "Rahul Sharma",
      email,
      passwordHash: await hashPassword(password),
      currency: "INR",
    })
  }

  // Demo login always refreshes the demo story so the account stays consistent
  await seedDemoUserData(user._id.toString())
  user = await User.findById(user._id)
  if (!user) {
    return NextResponse.json({ error: "Failed to prepare demo user" }, { status: 500 })
  }

  const token = signAuthToken({ sub: user._id.toString(), email: user.email, name: user.name })
  const res = NextResponse.json({
    user: { id: user._id.toString(), name: user.name, email: user.email, currency: user.currency },
    demo: true,
  })
  res.cookies.set(AUTH_COOKIE_NAME, token, authCookieOptions())
  return res
}
