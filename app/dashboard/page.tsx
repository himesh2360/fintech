import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardClient } from "@/components/dashboard/dashboard-client"
import { CopilotModal } from "@/components/copilot/copilot-modal"
import { LogoutButton } from "@/components/auth/logout-button"
import { ExportPdfButton } from "@/components/reports/export-pdf-button"

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <DashboardHeader />

      <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-7">
        <DashboardClient />
      </main>

      <CopilotModal />

      <footer className="mx-auto w-full max-w-6xl px-4 pb-8 pt-4 sm:px-6">
        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-[11px] leading-5 text-muted-foreground">
            FinSight is educational decision support — not SEBI-registered investment advice. Figures may be
            illustrative. Always verify before acting.
          </p>
          <div className="flex shrink-0 gap-2 sm:hidden">
            <ExportPdfButton />
            <LogoutButton />
          </div>
        </div>
      </footer>
    </div>
  )
}
