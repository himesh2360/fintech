import type { Metadata } from "next"
import { DM_Sans, Geist_Mono, Newsreader } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { Toaster } from "@/components/ui/sonner"

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "FinSight — Know what to do with your money",
  description:
    "FinSight is a trust-first financial decision platform: ranked next steps, explainable health scores, and invest guidance only after debt and emergency-fund checks.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSans.variable} ${newsreader.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
          <Toaster richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  )
}
