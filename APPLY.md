# Mitra-9 Sales Planning Tool — Phases A + B + C

This bundle contains the full set of changes for all three phases:

- **Phase A** — Replace the legacy "Forecast Entry" tab with an Excel-style **Reforecast Grid** wired to real Mitra-9 master data from Book4 (41 distributors, 5 regions, 30 reps).
- **Phase B** — New **Target Setting** page (manager-only) with two tabs: Distributor Targets and Rep Targets.
- **Phase C** — **R&O cascade rework**: "Convert to R&O" button on Initiatives, Go Get badges on R&O Tracker, banner showing how many R&Os are flowing into the grid as Go Gets.

## Apply to your local clone

From the root of your local `mitra9-sales-tool` clone:

```bash
# 1. Untar the bundle into the repo, overwriting changed files
tar xzf /path/to/mitra9-all-phases.tar.gz

# 2. Install the new dep (xlsx for Excel export)
npm install

# 3. Smoke-test
npm run dev
```

Then commit and push:

```bash
git add -A
git commit -m "Phases A+B+C: forecast grid, target setting, R&O cascade"
git push
```

StackBlitz will pick up the new commit automatically.

## What you'll see in the app

### Plan & Forecast (`/plan`)
The default tab is now **Reforecast Grid**. Login as `steve@mitra-9.com` (or any manager email) with password `mitra9demo`. You'll see:
- 5 collapsible Conventional regions (Florida → Steve, North → Derrick, West → Lexi, East → Darrell, South → Steven V.)
- 4 non-Conventional channel sections (Inbound, New Distribution, Wholesale, Chains)
- Each section: partner rows + Other rolled-up row + Subtotal + MTD Landed line + Go Get rows + Subtotal + Go Gets
- Past months (Jan-Mar) read-only grey, April amber with MTD actuals from BigQuery mock, May-Dec editable
- Click any future cell → input. Tab/Shift+Tab/Enter/Escape work as expected.
- "Export to Excel" button generates a `.xlsx` with two sheets matching Book3 format.

The legacy entry form is still accessible via the "Legacy Entry" tab.

### Target Setting (`/targets`) — managers only
- **Distributor Targets** tab: full editable yearly+monthly grid, grouped by region/channel, with section subtotals + grand total of $22.3M.
- **Rep Targets** tab: 23 reps with seed data from Book4, organized by channel, with channel-level subtotals.

### Initiatives (`/initiatives`)
Each card now has a small ↗ icon. Click it on an unlinked initiative to convert it to an R&O Opportunity — confirms first, creates the R&O with derived impact range and probability, and links them. Already-converted cards show a green checkmark instead.

### Risks & Opportunities (`/risks`)
- Top banner: "X incremental opportunities (Y total EV) are appearing as Go Get rows in the Forecast Grid"
- Each incremental opportunity shows a green "↗ On Grid · Go Get" tag

## Login emails (mock mode, password `mitra9demo` for all)

**Managers:** `todd@mitra-9.com`, `albert@mitra-9.com`, `jr@mitra-9.com`

**Conventional regional leads:** `steve@mitra-9.com` (FL), `derrick@mitra-9.com` (N), `lexi@mitra-9.com` (W), `darrell@mitra-9.com` (E), `steven@mitra-9.com` (S)

**Channel leads:** `karli@mitra-9.com` (Inbound), `evan@mitra-9.com` (New Dist), `noah@mitra-9.com` (Wholesale), `joe@mitra-9.com` (Chains)

Reps see their own region's editable cells; managers see all.

## Database schema notes (when you swap mock → real Supabase)

The migration `supabase/migrations/002_grid_schema.sql` adds 7 new tables:

- `regions`, `teams` — org structure
- `distributors` — canonical master list (replaces the old hardcoded distributor names)
- `distributor_yearly_targets`, `distributor_targets` — yearly + monthly plans
- `forecast_cells` — atomic per-cell forecast entries (replaces `forecast_entries` for grid use)
- `forecast_submissions` — per-rep month-level approval workflow
- `rep_targets` — total revenue target per rep per month

RLS is set up: managers can write everything; reps can only edit `forecast_cells` for distributors where `owner_rep_id = auth.uid()`. Realtime is enabled on all new tables.

The seed file `supabase/seed/002_seed_grid.sql` populates the same data the mock store uses.

## Known gaps (deferred)

- Add/remove partner rows inline within a section (just data inserts, ~30 lines)
- Save-as-draft → submit-month workflow with the new `forecast_submissions` table
- Paste-from-Excel for cell ranges
- Excel import via the dp_targets template format
- Per-cell hover tooltip with last-edit timestamp + author

These are all small, scoped additions when you're ready.
