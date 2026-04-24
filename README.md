# Mitra-9 Sales Planning & Operations Tool

A multi-user sales planning tool built to replace spreadsheet-based workflows across the Mitra-9 commercial org. Combines read-only actuals from BigQuery with collaborative planning data in Supabase.

## What's inside

Seven modules, accessible by role (manager / rep / viewer):

| Module | What it does |
|---|---|
| **Dashboard** | MTD revenue, pacing to plan, 6-mo trend, channel RAG breakdown, forecast submission tracker, top risks/opps, upcoming promos, live activity feed |
| **Plan & Forecast** | Three tabs: rep-level forecast entry (partner × category granularity), Plan vs Bottom-up Forecast vs Actual variance, plan-to-actuals waterfall bridge |
| **R&O Tracker** | Risks and Opportunities with EV calc (low/mid/high × probability), base vs incremental classification, ownership, aging, comments, promote-to-base action |
| **Initiatives** | 5-stage kanban with golf-style weighted composite scoring (managers can tune weights), confidential flag, links to R&O / promos, full ranking view |
| **Promo Calendar** | Quarter / month / list views with lane-packed promo bars and tentpole markers, lead-time warnings under 60 days, materials / pricing / distributor detail |
| **Miss Calculator** | Todd's 3-component true-cost model: direct miss + SKU substitution loss + 3-month momentum drag, with configurable assumptions |
| **Distributor Scorecard** | Partner performance vs targets with fill rate, order frequency, RAG bucketing, and one-click flag-to-R&O for underperformers |

## Architecture

```
┌─────────────────────┐       ┌──────────────────────────────┐
│  BigQuery (read-only)│──────▶│ /api (Node stub → REST)     │
│  actuals, rollups    │       │ Replace with real service    │
└─────────────────────┘       └──────────────────────────────┘
                                         │
                                         ▼
                              ┌──────────────────────┐
                              │  React + Vite UI     │
                              │  src/pages/*         │
                              └──────────────────────┘
                                         ▲
                                         │
┌─────────────────────┐                  │
│  Supabase Postgres  │──── realtime ────┘
│  plans, forecasts,  │
│  R&O, initiatives,  │
│  promos, comments   │
└─────────────────────┘
```

Two persistence layers:

- **BigQuery** (project `elevate-analytics-361821`) — source of truth for actuals. Accessed through a thin `/api` stub that you'd swap for your real BQ-backed service. Queries used today: `revenue_rollup` and `product_detail`, with the business rule `business_channel='Distributor' AND order_type='New Deal'` → `sales_rep_clean='Evan Beard'`, `business_channel_v2='New Distribution'` baked in server-side.
- **Supabase** — everything users create: annual plan, forecasts (with draft/submit/approve flow), reforecasts, bridge buckets, R&O, initiatives, promos, distributor targets, miss model assumptions, comments, activity log. Full RLS, realtime on all collaborative tables.

The app ships with an in-memory mock store seeded with realistic April 2026 data, so you can run it end-to-end with no external services.

## Prerequisites

- Node 20+
- (Optional) Supabase project
- (Optional) BigQuery access — only if you swap the stub API for real queries

## Local dev — 60-second start

```bash
cd mitra9-sales-tool
npm install
cp .env.example .env          # defaults to mock mode
npm run dev                   # Vite on :5173
# In another tab:
npm run api                   # BigQuery stub on :3001
```

Open http://localhost:5173 and pick any of the 10 demo users from the dropdown.

## Full setup with Supabase

1. Create a Supabase project.
2. Run the migration:
   ```sql
   -- In Supabase SQL editor, paste & run:
   supabase/migrations/001_initial_schema.sql
   ```
3. Create the ten auth users (this needs the service role key):
   ```bash
   cd supabase/seed
   SUPABASE_URL=https://xxx.supabase.co \
   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
     node create_auth_users.js
   ```
4. Run the data seed:
   ```sql
   supabase/seed/001_seed.sql
   ```
5. Fill in `.env`:
   ```
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   VITE_USE_MOCK_DATA=false
   ```
6. Restart `npm run dev`. The login screen switches to email + password (all demo users have password `mitra9demo`).

## Connecting real BigQuery

Replace `api/server.js` with your own service (Node, Python, whatever) that serves the same six endpoints:

- `GET /api/actuals/revenue?fy=&month=`
- `GET /api/actuals/by-channel?fy=&month=`
- `GET /api/actuals/by-distributor?fy=&month=`
- `GET /api/actuals/by-product?fy=&month=`
- `GET /api/actuals/daily-pacing?fy=&month=`
- `GET /api/actuals/trend?fy=&month=&months=`

Every endpoint returns shapes documented at the top of `src/lib/bigqueryApi.js`. The underlying SQL you already have for `revenue_rollup` and `product_detail` plugs straight in — just make sure the `business_channel='Distributor' AND order_type='New Deal'` → Evan Beard mapping is applied before aggregating.

Then point `VITE_BIGQUERY_API_URL` at the new service.

## Role model

| Role | Read | Write |
|---|---|---|
| **manager** (Todd, Albert, JR) | Everything, including confidential initiatives | Everything |
| **rep** | Own forecasts, all R&O (scoped to their channel), non-confidential initiatives, own promos | Own forecast drafts, R&O (own only for destructive actions), initiatives they create |
| **viewer** (Emily) | Read-only across the board | Nothing — but can access Miss Calculator for modeling |

Enforced at three layers: (1) Supabase RLS policies, (2) React route guards (`RequireRole`), (3) UI affordances (buttons hidden / disabled).

## Key business logic

- **New Distribution mapping** — `business_channel='Distributor' AND order_type='New Deal'` maps to Evan Beard / New Distribution channel. Applied in the BigQuery stub and documented in the real-API swap notes.
- **Expected Value** — `impact_mid × probability` (stored as a generated column in Postgres).
- **Composite initiative score** — weighted sum of 5 dimensions, golf-style (lower = better). Weights tunable by managers. Revenue, strategic alignment are inverted so higher-is-better inputs still produce lower-is-better outputs.
- **Miss multiplier** — `(direct_miss + substitution_loss + momentum_drag) / delayed`. Momentum drag sums 3 lag months at declining rates, scaled to miss size, capped at base store revenue.
- **RAG bucketing** — green ≥ 100%, amber 80–99%, red < 80%. Consistent across Dashboard and Distributor Scorecard.
- **Currency format** — `$1,016.3K` (comma separator at ≥ $1M compact display). Controlled centrally in `src/lib/format.js`.

## File layout

```
mitra9-sales-tool/
├── api/                          Node stub for BigQuery actuals
├── supabase/
│   ├── migrations/001_initial_schema.sql
│   └── seed/
│       ├── create_auth_users.js
│       └── 001_seed.sql
├── src/
│   ├── components/
│   │   ├── layout/Shell.jsx      Sidebar + header
│   │   └── ui/Primitives.jsx     Card, Tag, Modal, StatTile, RagDot, EmptyState
│   ├── data/
│   │   ├── mockUsers.js
│   │   ├── mockActuals.js
│   │   └── mockStore.js          Reactive in-memory store
│   ├── hooks/
│   │   ├── useAuth.jsx           Supabase auth + demo mode
│   │   ├── useTable.js           Row subscription + mutators
│   │   └── useAsync.js
│   ├── lib/
│   │   ├── supabase.js
│   │   ├── bigqueryApi.js
│   │   └── format.js
│   ├── pages/                    Seven feature modules
│   ├── App.jsx                   Routes + guards
│   ├── main.jsx
│   └── index.css
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── .env.example
```

## Demo users (mock mode)

| Name | Role | Channel |
|---|---|---|
| Todd Allison | manager | — |
| Albert Martinez | manager | — |
| JR Hernandez | manager | — |
| Evan Beard | rep | New Distribution |
| Alissa Shupperd | rep | Inbound |
| Noah Smith | rep | Wholesale |
| Joe Sanders | rep | Chains |
| Nick Kemper | rep | New Distribution |
| Luis Escobar | rep | Conventional (FL) |
| Emily Hill | viewer | — |

Switch users at any time via the login screen dropdown in mock mode to see the role-based UI differences.

## Deployment

Any static host works for the frontend (Vercel, Netlify, Cloudflare Pages):

```bash
npm run build
# Deploy the ./dist folder
```

For the BigQuery API, deploy `api/server.js` (or your replacement) to Cloud Run / Lambda / Fly. Set CORS to allow your Vercel domain. Update `VITE_BIGQUERY_API_URL` in your host's env config.

Supabase hosting is managed — just make sure the migration and seed have been run against the production project.

## Notes & next steps

- The Dashboard's daily-pacing fixture is a realistic April 2026 curve. Replace it with a `SUM(revenue) OVER (PARTITION BY month ORDER BY day)` query on your actuals table when you wire up real BigQuery.
- The miss-impact model's default assumptions are deliberate starting points — Todd should calibrate them against the actual history of delayed orders.
- Comments and activity log both work in realtime via Supabase channels once you're off mock mode. The dashboard activity feed picks up changes within a second.
- The initiative scoring function is in `src/pages/InitiativesPage.jsx` (`computeScore`). Bucket thresholds are hard-coded; consider moving to a config table if they need to vary by FY.
