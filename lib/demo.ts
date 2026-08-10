export function demoEmail() {
  return (process.env.DEMO_EMAIL || "demo@finsight.app").toLowerCase()
}

export function isDemoUser(email?: string | null) {
  return !!email && email.toLowerCase() === demoEmail()
}
