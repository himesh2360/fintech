"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

type LoginValues = z.infer<typeof LoginSchema>

export function LoginClient() {
  const router = useRouter()
  const search = useSearchParams()
  const next = search.get("next") || "/dashboard"
  const [demoLoading, setDemoLoading] = React.useState(false)

  const form = useForm<LoginValues>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: "", password: "" },
  })

  async function onSubmit(values: LoginValues) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data?.error || "Login failed")
      return
    }

    toast.success("Welcome back")
    router.push(next)
    router.refresh()
  }

  async function onDemo() {
    setDemoLoading(true)
    try {
      const res = await fetch("/api/demo/login", { method: "POST", credentials: "include" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Demo login failed")
      }
      toast.success("Logged in as demo user")
      router.push(next)
      router.refresh()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Demo login failed"
      toast.error(msg)
    } finally {
      setDemoLoading(false)
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Log in to your FinSight workspace.">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label className="text-slate-100" htmlFor="email">
            Email
          </Label>
          <Input
            id="email"
            placeholder="you@company.com"
            autoComplete="email"
            className="h-11 border-white/25 bg-white/10 text-white placeholder:text-slate-400 focus-visible:border-teal-300/50 focus-visible:ring-teal-300/30"
            {...form.register("email")}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-slate-100" htmlFor="password">
              Password
            </Label>
            <Link href="/forgot" className="text-xs font-medium text-teal-200 hover:text-teal-100">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            className="h-11 border-white/25 bg-white/10 text-white placeholder:text-slate-400 focus-visible:border-teal-300/50 focus-visible:ring-teal-300/30"
            {...form.register("password")}
          />
        </div>

        <Button
          type="submit"
          className="h-11 w-full rounded-xl bg-white text-[#0c1b2a] hover:bg-slate-100"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
        </Button>

        <Button
          type="button"
          className="h-11 w-full rounded-xl border border-white/25 bg-white/10 text-white hover:bg-white/15"
          onClick={onDemo}
          disabled={demoLoading || form.formState.isSubmitting}
        >
          {demoLoading ? "Loading demo…" : "Try demo account"}
        </Button>

        <div className="text-center text-sm text-slate-200">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-semibold text-teal-200 hover:text-teal-100 hover:underline">
            Sign up
          </Link>
        </div>
      </form>
    </AuthShell>
  )
}
