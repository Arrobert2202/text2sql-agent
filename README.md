# DataBot AI — Enterprise RevOps Text-to-SQL Slack Agent

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16%20App%20Router-black.svg)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-blue.svg)](https://github.com/pgvector/pgvector)
[![Security](https://img.shields.io/badge/Security-AES--256--GCM-red.svg)](https://en.wikipedia.org/wiki/Galois/Counter_Mode)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

**DataBot AI** is an enterprise-grade, multi-tenant B2B RevOps intelligence platform. It seamlessly connects natural language Slack threads with your PostgreSQL data warehouse, translating team questions into verified SQL queries, interactive QuickChart visualizations, and downloadable executive PDF reports.

---

## Key Enterprise Features

- **Strictly Read-Only Execution Layer:** Tenant queries are executed exclusively through dedicated read-only connection pools configured with `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;`, eliminating any risk of destructive queries (`DROP`, `DELETE`, `UPDATE`, `ALTER`).
- **Semantic Vector Caching (Cost & Margin Protection):** Utilizes `pgvector` and `text-embedding-3-small` with cosine similarity (`<=>`) to bypass OpenAI calls for repeat or near-duplicate queries (> 0.96 similarity within 24 hours).
- **Automated Scheduled Reports:** Parses natural language scheduling intents (e.g., *"Generate a win rate report every Monday at 9am"*) into cron schedules and delivers branded executive PDF reports directly to Slack.
- **Hybrid Metered Overage Billing:** Tracks monthly query quotas (200 included queries) and reports usage overages in real-time to Stripe via Meter Events (`$10 per 100 extra queries`).
- **RevOps Context Hub Dashboard:** Modern Next.js 15 App Router web application built with Tailwind CSS and `shadcn/ui`, featuring:
  - **Metric Builder:** Canonical metric definitions (`Win Rate`, `Pipeline Velocity`, `NRR`, `Average Deal Size`).
  - **Database Settings:** AES-256-GCM encrypted external database credentials with live connection testing.
  - **Playground:** Real-time Text-to-SQL simulation and SQL review.
  - **Usage Telemetry:** Real-time quota and cache efficiency monitoring.
- **Merchant of Record Compliance:** Built-in Privacy Policy and Terms of Service pages compliant with Lemon Squeezy and GDPR standards.

---

## Repository Structure

```
text2sql-agent/
├── src/                          # Express backend (TypeScript)
│   ├── config/                   # Environment validation (Zod)
│   ├── controllers/              # Request handlers (Ask, Stripe)
│   ├── db/                       # Database interfaces & PostgreSQL migrations
│   ├── middlewares/              # Global error & logging middleware
│   ├── routes/                   # API routes (Ask, Slack, Teams, Stripe, Workspace)
│   ├── services/                 # Business logic
│   │   ├── ai.service.ts         # Text-to-SQL, Semantic Caching, RAG
│   │   ├── pdf-export.service.ts # Executive PDF generation (PDFKit)
│   │   ├── scheduler.service.ts  # Recurring Slack reports (node-cron)
│   │   ├── tenant-db.manager.ts  # Multi-tenant DB connection pool manager
│   │   └── workspace.service.ts  # Tenant provisioning & query metering
│   ├── utils/                    # AES-256-GCM encryption & Pino logger
│   └── app.ts                    # Express application entry
├── web/                          # Next.js 15 App Router frontend
│   ├── app/
│   │   ├── (dashboard)/          # Authenticated Context Hub (/metrics, /settings, etc.)
│   │   └── (marketing)/          # Public landing page, /terms-of-service, /privacy-policy
│   ├── components/               # shadcn/ui components & sidebar layout
│   ├── hooks/                    # React hooks (useIsMobile with useSyncExternalStore)
│   └── lib/                      # Typed backend API client & utilities
├── .env.example                  # Backend environment template
├── package.json                  # Backend dependencies & scripts
└── tsconfig.json                 # TypeScript compiler configuration
```

---

## Quick Start

### 1. Prerequisites

- **Node.js** v20.x or higher
- **PostgreSQL 15+** with the [`pgvector`](https://github.com/pgvector/pgvector) extension enabled:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ```
- **OpenAI API Key** (with access to `gpt-4o-mini` and `text-embedding-3-small`)
- **Slack App** (Bot Token & Signing Secret)

---

### 2. Environment Configuration

Copy the sample environment file in the root directory:

```bash
cp .env.example .env
```

Configure your environment variables in `.env`:

```env
# Application
PORT=3000

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Slack
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret

# Primary Database (PostgreSQL with pgvector)
DATABASE_URL=postgres://postgres:password@localhost:5432/databot_db

# Stripe (Optional for local testing)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Security (AES-256-GCM 32-byte secret key)
ENCRYPTION_KEY=replace_with_a_secure_32_byte_secret_key!

# Dedicated Read-Only DB Role
DB_READONLY_USER=databot_readonly
DB_READONLY_PASSWORD=secure_readonly_password_here
```

---

### 3. Start Backend Server

```bash
# Install dependencies
npm install

# Start Express server in development mode (port 3000)
npm run dev
```

The database schema migrations, `pgvector` extension setup, and dedicated read-only PostgreSQL role will automatically initialize upon server start.

---

### 4. Start Next.js Frontend Dashboard

In a separate terminal:

```bash
cd web

# Install frontend dependencies
npm install

# Start Next.js development server (port 3001)
npm run dev -- -p 3001
```

Access the frontend applications:
- **Landing Page:** [http://localhost:3001](http://localhost:3001)
- **Context Hub Dashboard:** [http://localhost:3001/metrics](http://localhost:3001/metrics)
- **Database Settings:** [http://localhost:3001/settings](http://localhost:3001/settings)
- **Query Simulator:** [http://localhost:3001/playground](http://localhost:3001/playground)

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/ask` | Natural language Text-to-SQL query processor |
| `POST` | `/api/slack/events` | Slack bot event webhook (threads, mentions, slash commands) |
| `GET` | `/api/workspaces/db-config` | Fetch masked tenant database connection configuration |
| `PUT` | `/api/workspaces/db-config` | Store AES-256-GCM encrypted database credentials |
| `POST` | `/api/workspaces/test-connection` | Verify read-only database connectivity and test credentials |
| `POST` | `/api/stripe/webhook` | Verified Stripe billing webhook listener |

---

## Testing & Code Quality

Run tests and type checks across the full stack:

```bash
# Typecheck backend
npx tsc --noEmit

# Lint frontend
cd web && npm run lint

# Build frontend
cd web && npx next build --webpack
```

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

