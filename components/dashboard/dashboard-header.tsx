"use client"

import * as React from "react"
import Link from "next/link"
import { MenuIcon } from "lucide-react"

import { Logo } from "@/components/brand/logo"
import { LogoutButton } from "@/components/auth/logout-button"
import { ThemeToggle } from "@/components/theme-toggle"
import { ExportPdfButton } from "@/components/reports/export-pdf-button"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function DashboardHeader() {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-3.5">
        <Logo />
        <nav className="flex items-center gap-1.5 sm:gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden rounded-xl text-foreground md:inline-flex">
            <Link href="/goals">Goals</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden rounded-xl text-foreground md:inline-flex">
            <Link href="/settings">Settings</Link>
          </Button>
          <div className="hidden sm:block">
            <ExportPdfButton />
          </div>
          <ThemeToggle />
          <div className="hidden sm:block">
            <LogoutButton />
          </div>

          {mounted ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-xl md:hidden">
                  <MenuIcon className="size-4" />
                  <span className="sr-only">Menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl">
                <DropdownMenuItem asChild>
                  <Link href="/goals">Goals</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/">Landing</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="outline" size="icon" className="rounded-xl md:hidden">
              <MenuIcon className="size-4" />
            </Button>
          )}
        </nav>
      </div>
    </header>
  )
}
