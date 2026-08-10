import { NextResponse, type NextRequest } from "next/server"

import { AUTH_COOKIE_NAME } from "@/lib/auth"

const PROTECTED_PREFIXES = ["/dashboard", "/goals", "/settings", "/reports"]
const AUTH_PAGES = ["/login", "/signup"]

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p))

  if (isProtected && !token) {
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  if (isAuthPage && token) {
    const url = req.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/goals/:path*",
    "/settings/:path*",
    "/reports/:path*",
    "/login",
    "/signup",
  ],
}