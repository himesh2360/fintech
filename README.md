## FinSight — A Unified Financial Intelligence & Decision-Support Platform

FinSight is a startup-grade FinTech MVP built for hackathon demos: **JWT auth**, a **decision-first financial dashboard**, **budget & expense tracking**, **rule-based insights**, **smart alerts**, goals, and PDF export.

**Positioning:** decision support (“what should I do now?”) — not a bank aggregator. VisualPe-style money views (assets, portfolio, UPI, charts) support the decisions; they are not the product itself.

Built by **Team focus_4**.

### Tech stack

- **Frontend**: Next.js (App Router) + TypeScript + Tailwind v4 + shadcn/ui + Framer Motion + Recharts
- **Backend**: Next.js Route Handlers (Node.js runtime)
- **DB**: MongoDB (Mongoose)
- **Auth**: JWT (HttpOnly cookie) + bcrypt hashing
- **Extras**: Dark/Light mode, PDF export, goal tracker, bank-linking mock, biometric mock, fraud-simulation toggle

### Local setup (recommended)

1) Install dependencies

```bash
npm install
```

2) Configure environment variables

Copy `.env.example` → `.env.local` and set at least:

- `MONGODB_URI`
- `JWT_SECRET`

Optional demo overrides:

- `DEMO_EMAIL` (default `demo@finsight.app`)
- `DEMO_PASSWORD` (default `demo12345`)

3) Run MongoDB

- **Option A (local MongoDB)**: ensure MongoDB is running and `MONGODB_URI` points to it.
- **Option B (Docker MongoDB)**:

```bash
docker compose up -d mongo
```

4) Start the app

```bash
npm run dev
```

Open `http://localhost:3000`.

**If you get "Unable to acquire lock" or "Port 3000 is in use":**  
Run this once to kill the old dev server and remove the lock, then start fresh:

```bash
npm run dev:fresh
```

Or manually: `npm run dev:kill` then `npm run dev`.  
On Windows you can also run `.\scripts\dev-fresh.ps1` in PowerShell.

### Demo vs real signup

| Path | What you get |
|------|----------------|
| **Try demo account** (login page) | Seeds demo user + budgets, goals, transactions; rich decision story |
| **Email signup** | Empty account — charts, risk, UPI, and recommendations stay empty until you add real data |

On the login page, click **“Try demo account”**. That calls `/api/demo/seed` then `/api/demo/login`.

### Key routes

- `/` — Landing page
- `/login`, `/signup`, `/forgot` — Auth
- `/dashboard` — Tabs: **Decide** / **Overview** / **Analytics** / **Activity**
  - **Today’s moves** (ranked actions with why + impact)
  - **Explainable health score** (driver breakdown)
  - **Risk radar** (interest arbitrage, EF gap, credit stress)
  - **Invest suggestions** (only after debt & emergency-fund checks)
  - **What-if simulator** (cut spend / extra EMI / invest → score delta)
  - Assets, portfolio, UPI, KPIs, charts, insights (from live data; empty until you add activity)
- `/goals` — Goal tracker
- `/settings` — Security + integrations demo settings

### API endpoints (high level)

- `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET/POST /api/transactions`, `PATCH/DELETE /api/transactions/:id`
- `GET/PUT /api/budgets`
- `GET/POST /api/goals`, `PATCH/DELETE /api/goals/:id`
- `GET /api/dashboard/summary`
- `GET /api/insights`
- `GET /api/decisions`, `POST /api/decisions` (what-if simulator)
- `GET /api/notifications`
- `GET /api/report/pdf`
- `POST /api/demo/seed`, `POST /api/demo/login`

### Docker (full stack)

Build and run app + MongoDB:

```bash
docker compose up --build
```

Then open `http://localhost:3000`.

### x402 Micropayments Track (Algorand)

FinSight ships an **Entry Management Framework** Agent Treasury for autonomous agents (100% judging map in **[X402.md](./X402.md)**):

- Live orchestrator: `POST /api/v1/agent/execute` (`@x402/next` + GoPlausible) → HTTP 402 unpaid
- Atomic micro-APIs: `/api/v1/x402/services/{search,llm,verify}` + spend policy guard
- Live settle helper: `POST /api/v1/agent/live-pay` / `npm run x402:live` (needs `AVM_PRIVATE_KEY`)
- Demo walkthrough: `POST /api/v1/agent/demo` — UI always proves live 402 first
- Discovery: `GET /api/x402/discovery`

### Notes

- Auth is **JWT in an HttpOnly cookie** (middleware guards protected routes).
- Decision support is **deterministic and rule-based** (amounts, ranking, invest-vs-debt). Optional OpenAI/OpenRouter powers the AI Copilot when keys are set.
- Hardcoded demo money data applies **only** to the seeded demo account; real signups start at zero.
- Agent x402 routes do **not** require JWT — agents pay per call in USDC.
- This repo ships **local-first** for the core dashboard; x402 live settle needs facilitator + funded Algorand USDC.
