-- =============================================================================
-- 002_grid_schema.sql
-- Adds the structured master data and per-cell forecast tables required for
-- the Excel-style forecast grid. Run AFTER 001_initial_schema.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Regions (Florida, North, West, East, South — Conventional channel only)
-- -----------------------------------------------------------------------------
CREATE TABLE regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,             -- 'Florida', 'North', 'West', 'East', 'South'
  channel TEXT NOT NULL,                 -- always 'Conventional' today
  lead_rep_id UUID REFERENCES profiles(id),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Teams (Florida Team, North Team, etc. — used by rep_targets later)
-- A team belongs to a channel; for Conventional, also to a region.
-- -----------------------------------------------------------------------------
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,             -- 'Florida Team', 'Inbound Team', 'Wholesale Team', etc.
  channel TEXT NOT NULL,                 -- 'Conventional' | 'Inbound' | 'New Distribution' | 'Wholesale' | 'Chains'
  region_id UUID REFERENCES regions(id), -- nullable: only Conventional teams have a region
  lead_rep_id UUID REFERENCES profiles(id),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Distributors (canonical master list, ~41 rows from dp_targets + non-Conv ones)
-- -----------------------------------------------------------------------------
CREATE TABLE distributors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  lead_name TEXT,                          -- contact / DBA shorthand
  channel TEXT NOT NULL,                   -- one of the channel values above
  region_id UUID REFERENCES regions(id),   -- only for Conventional
  team_id UUID REFERENCES teams(id),       -- which team owns the relationship
  owner_rep_id UUID REFERENCES profiles(id),
  -- A "row kind" flag so the grid can render specials differently
  row_kind TEXT NOT NULL DEFAULT 'partner' CHECK (
    row_kind IN ('partner', 'other', 'go_get', 'ro')
  ),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_dist_per_channel UNIQUE (name, channel)
);

CREATE INDEX idx_distributors_channel ON distributors(channel);
CREATE INDEX idx_distributors_region  ON distributors(region_id);
CREATE INDEX idx_distributors_team    ON distributors(team_id);

-- -----------------------------------------------------------------------------
-- Distributor Targets — the dp_targets data: yearly + 12 monthly cells per dist.
-- Replaces the old (distributor_targets) table from 001 with a richer shape.
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS distributor_targets CASCADE;

CREATE TABLE distributor_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id UUID NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  fiscal_year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  target_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  set_by UUID REFERENCES profiles(id),
  set_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_dist_target UNIQUE (distributor_id, fiscal_year, month)
);

-- Yearly estimate is independent of the monthly spread (used as the canonical
-- annual number; spreads can drift from it during reforecasting).
CREATE TABLE distributor_yearly_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id UUID NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  fiscal_year INT NOT NULL,
  yearly_estimate NUMERIC(12,2) NOT NULL DEFAULT 0,
  CONSTRAINT unique_dist_year UNIQUE (distributor_id, fiscal_year)
);

-- -----------------------------------------------------------------------------
-- Forecast Cells — one row per (distributor × month). This is the new
-- atomic unit of the grid; replaces forecast_entries.
-- -----------------------------------------------------------------------------
-- We keep forecast_entries around in case it's referenced elsewhere; new
-- code uses forecast_cells. To clean up later, you can drop forecast_entries.

CREATE TABLE forecast_cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id UUID NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  fiscal_year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  forecasted_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- Editorial fields
  notes TEXT,
  -- Audit
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_cell UNIQUE (distributor_id, fiscal_year, month)
);

CREATE INDEX idx_fcell_year_month ON forecast_cells(fiscal_year, month);
CREATE INDEX idx_fcell_dist       ON forecast_cells(distributor_id);

-- -----------------------------------------------------------------------------
-- Forecast Submissions — one record per (rep × FY × month) capturing approval
-- state. Replaces the per-row submission state from forecast_entries. This
-- way reps submit "their grid for May" as a single action.
-- -----------------------------------------------------------------------------
CREATE TABLE forecast_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by UUID NOT NULL REFERENCES profiles(id),
  fiscal_year INT NOT NULL,
  -- Submission can be for a specific month-forward or the entire FY
  scope TEXT NOT NULL DEFAULT 'month' CHECK (scope IN ('month', 'remaining_fy')),
  scope_month INT CHECK (scope_month BETWEEN 1 AND 12),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'submitted', 'approved', 'revised')
  ),
  submitted_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subs_rep_year ON forecast_submissions(submitted_by, fiscal_year);

-- -----------------------------------------------------------------------------
-- Rep Targets — total revenue per rep per month
-- Simplified per business request: only total revenue (no Seltzer/Shots/cases)
-- -----------------------------------------------------------------------------
CREATE TABLE rep_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fiscal_year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  target_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  set_by UUID REFERENCES profiles(id),
  set_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_rep_target UNIQUE (rep_id, fiscal_year, month)
);

CREATE INDEX idx_rep_targets_year_month ON rep_targets(fiscal_year, month);

-- -----------------------------------------------------------------------------
-- R&O linkage to forecast cells
-- -----------------------------------------------------------------------------
-- Allow an R&O item to "be" a row in the forecast grid (e.g. a Go Get or
-- inline R&O block row). When set, the distributor_id on ro_items points to
-- a row_kind='ro' or 'go_get' distributor, and forecast_cells under that
-- distributor are the truth.
ALTER TABLE ro_items
  ADD COLUMN IF NOT EXISTS distributor_id UUID REFERENCES distributors(id);

CREATE INDEX IF NOT EXISTS idx_ro_distributor ON ro_items(distributor_id);

-- Initiative linkage already exists via linked_ro_id; nothing to add.

-- -----------------------------------------------------------------------------
-- Updated_at triggers for the new tables
-- -----------------------------------------------------------------------------
CREATE TRIGGER set_updated_at_distributors
  BEFORE UPDATE ON distributors
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_updated_at_forecast_cells
  BEFORE UPDATE ON forecast_cells
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_updated_at_forecast_submissions
  BEFORE UPDATE ON forecast_submissions
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS — managers write everything, reps edit their own forecast cells
-- -----------------------------------------------------------------------------
ALTER TABLE regions                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributors               ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributor_targets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributor_yearly_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_cells             ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_submissions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_targets                ENABLE ROW LEVEL SECURITY;

-- Read = everyone authenticated
CREATE POLICY "auth read regions"   ON regions   FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth read teams"     ON teams     FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth read dist"      ON distributors FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth read dt"        ON distributor_targets FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth read dyt"       ON distributor_yearly_targets FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth read fc"        ON forecast_cells FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth read fsub"      ON forecast_submissions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth read rt"        ON rep_targets FOR SELECT USING (auth.role() = 'authenticated');

-- Write = managers
CREATE POLICY "mgr write regions" ON regions FOR ALL
  USING (public.current_user_role() = 'manager') WITH CHECK (public.current_user_role() = 'manager');
CREATE POLICY "mgr write teams" ON teams FOR ALL
  USING (public.current_user_role() = 'manager') WITH CHECK (public.current_user_role() = 'manager');
CREATE POLICY "mgr write dist" ON distributors FOR ALL
  USING (public.current_user_role() = 'manager') WITH CHECK (public.current_user_role() = 'manager');
CREATE POLICY "mgr write dt" ON distributor_targets FOR ALL
  USING (public.current_user_role() = 'manager') WITH CHECK (public.current_user_role() = 'manager');
CREATE POLICY "mgr write dyt" ON distributor_yearly_targets FOR ALL
  USING (public.current_user_role() = 'manager') WITH CHECK (public.current_user_role() = 'manager');
CREATE POLICY "mgr write rt" ON rep_targets FOR ALL
  USING (public.current_user_role() = 'manager') WITH CHECK (public.current_user_role() = 'manager');

-- Forecast cells: reps may write cells for distributors they own; managers anywhere
CREATE POLICY "fc write self_or_mgr" ON forecast_cells FOR ALL
  USING (
    public.current_user_role() = 'manager'
    OR EXISTS (
      SELECT 1 FROM distributors d
      WHERE d.id = forecast_cells.distributor_id
        AND d.owner_rep_id = auth.uid()
    )
  )
  WITH CHECK (
    public.current_user_role() = 'manager'
    OR EXISTS (
      SELECT 1 FROM distributors d
      WHERE d.id = forecast_cells.distributor_id
        AND d.owner_rep_id = auth.uid()
    )
  );

-- Submissions: reps can submit their own; managers approve any
CREATE POLICY "fsub write own_or_mgr" ON forecast_submissions FOR ALL
  USING (
    public.current_user_role() = 'manager'
    OR submitted_by = auth.uid()
  )
  WITH CHECK (
    public.current_user_role() = 'manager'
    OR submitted_by = auth.uid()
  );

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE
  regions, teams, distributors,
  distributor_targets, distributor_yearly_targets,
  forecast_cells, forecast_submissions, rep_targets;
