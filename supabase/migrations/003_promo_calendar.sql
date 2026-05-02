-- =============================================================================
-- 003_promo_calendar.sql
-- Adds the promo calendar data model: SKUs, pricing tiers, POS materials,
-- redesigned promos with line items (per-SKU cases) and trade spend lines.
-- Run AFTER 002_grid_schema.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Add 'director' as a valid role on profiles
-- -----------------------------------------------------------------------------
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('manager', 'director', 'rep', 'viewer'));

-- -----------------------------------------------------------------------------
-- SKU master list
-- -----------------------------------------------------------------------------
CREATE TABLE skus (
  id TEXT PRIMARY KEY,                     -- 'sku-001' style stable IDs
  product_family TEXT NOT NULL,            -- 'Kratom Cans', 'Kava Cans', 'Shots Combo Kava+Kratom', etc.
  flavor TEXT NOT NULL,                    -- 'Tangerine', 'Variety Pack', 'Strawberry-Watermelon'
  brand TEXT,                              -- 'Kratom' or 'Kava'
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Pricing tiers — the canonical price book
-- -----------------------------------------------------------------------------
CREATE TABLE pricing_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_family TEXT NOT NULL,
  customer_class TEXT NOT NULL,            -- 'Retailer', 'Wholesaler', 'Distributor', 'eComm Everyday', etc.
  order_min INT NOT NULL DEFAULT 1,        -- inclusive lower bound on case count
  order_max INT,                           -- inclusive upper bound; NULL = no upper bound (e.g. 961+)
  price_per_case NUMERIC(10,2) NOT NULL,
  price_per_unit NUMERIC(10,4) NOT NULL,   -- per can / per bottle / per stick / per pour
  units_per_case INT,                       -- 24 for cans, 144 for shot mastercase, 40 for sticks, 55 for kegs
  shipping_terms TEXT,                     -- '$15/case', 'Free', '$300/flat'
  cogs_per_unit NUMERIC(10,4),             -- COGS per can/bottle/stick. Editable in admin.
  cogs_per_case NUMERIC(10,2),             -- = cogs_per_unit × units_per_case (denormalized for ease)
  msrp NUMERIC(10,2),                      -- consumer suggested retail
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pricing_tier_lookup ON pricing_tiers (product_family, customer_class, order_min, order_max)
  WHERE active = TRUE;

-- -----------------------------------------------------------------------------
-- POS Materials — items that can show up as trade spend
-- -----------------------------------------------------------------------------
CREATE TABLE pos_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,               -- 'Case Stacker', 'Acrylic', 'Shelf Talker', 'End Cap Kit'
  category TEXT,                            -- 'Display', 'Signage', 'Cooler', 'Premium', 'Other'
  cost_per_unit NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit_label TEXT DEFAULT 'each',          -- 'each', 'pack', 'set'
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Promos — redesigned. The legacy promos table from 001 had a simpler shape;
-- we keep it for now but the new app code uses promos_v2.
-- -----------------------------------------------------------------------------
CREATE TABLE promos_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  channel TEXT NOT NULL,                   -- 'Conventional' | 'Inbound' | 'New Distribution' | 'Wholesale' | 'Chains' | 'eCommerce' | 'Retail Direct'
  customer_class TEXT NOT NULL,            -- which pricing tier set to use; 'Distributor' / 'Wholesaler' / 'Retailer' / 'eComm Everyday'/...
  regions TEXT[] DEFAULT '{}',             -- ['Florida', 'West', ...] — only meaningful for Conventional
  -- Discount structure (applies across all SKU lines unless line override)
  discount_type TEXT DEFAULT 'none' CHECK (discount_type IN ('none', 'percent_off', 'dollar_off_per_case', 'billback_per_case')),
  discount_value NUMERIC(10,4) DEFAULT 0,  -- percent (e.g. 0.10 for 10%) or $ per case
  -- Status workflow
  status TEXT NOT NULL DEFAULT 'planning' CHECK (
    status IN ('planning', 'approved', 'active', 'completed', 'cancelled')
  ),
  -- Ownership
  owner_id UUID REFERENCES profiles(id),
  owner_name TEXT,
  -- Notes & supplementary
  pricing_mechanics_note TEXT,             -- '2 for $10 SRP', 'BOGO at Sprouts', etc.
  distributor_requirements TEXT,           -- 'Pricing notice 60 days in advance'
  -- Auto-generated calculated totals (denormalized for grid views; recomputed on save)
  total_cases NUMERIC(12,2) DEFAULT 0,
  gross_revenue NUMERIC(12,2) DEFAULT 0,
  total_discount NUMERIC(12,2) DEFAULT 0,  -- total $ taken off as discount/billback
  net_revenue NUMERIC(12,2) DEFAULT 0,     -- gross - discounts (not billback if billback is treated as trade spend)
  total_cogs NUMERIC(12,2) DEFAULT 0,
  gross_profit NUMERIC(12,2) DEFAULT 0,    -- net_revenue - cogs
  total_trade_spend NUMERIC(12,2) DEFAULT 0,
  contribution_profit NUMERIC(12,2) DEFAULT 0,  -- gross_profit - trade_spend
  trade_spend_pct NUMERIC(8,4),            -- trade_spend / gross_revenue
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_promos_dates ON promos_v2 (start_date, end_date);
CREATE INDEX idx_promos_channel ON promos_v2 (channel);
CREATE INDEX idx_promos_status ON promos_v2 (status);

-- -----------------------------------------------------------------------------
-- Promo SKU lines — per-SKU case quantities. If empty, the promo is family-level.
-- A single line can be a product-family-level entry (no sku_id) or SKU-level (with sku_id).
-- -----------------------------------------------------------------------------
CREATE TABLE promo_sku_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id UUID NOT NULL REFERENCES promos_v2(id) ON DELETE CASCADE,
  product_family TEXT NOT NULL,
  sku_id TEXT REFERENCES skus(id),         -- NULL = family-level entry
  cases NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- Pricing snapshot at the time the line was entered (so historical promos don't
  -- shift if the price book changes later)
  pricing_tier_id UUID REFERENCES pricing_tiers(id),
  price_per_case NUMERIC(10,2) NOT NULL,
  cogs_per_case NUMERIC(10,2) DEFAULT 0,
  -- Calculated
  gross_revenue NUMERIC(12,2) GENERATED ALWAYS AS (cases * price_per_case) STORED,
  total_cogs NUMERIC(12,2) GENERATED ALWAYS AS (cases * cogs_per_case) STORED,
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_promo_lines_promo ON promo_sku_lines (promo_id);

-- -----------------------------------------------------------------------------
-- Promo trade spend lines — itemized trade spend per promo
-- Categories: 'Coolers', 'Shelf Clips', 'Displays', 'Slotting', 'Samples', 'POS', 'Billback', 'Other'
-- A POS line references a pos_materials record + a quantity → cost auto-calculated.
-- -----------------------------------------------------------------------------
CREATE TABLE promo_trade_spend_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id UUID NOT NULL REFERENCES promos_v2(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'Coolers', 'Shelf Clips', 'Displays', 'Slotting', 'Samples', 'POS', 'Billback', 'Other'
  )),
  description TEXT NOT NULL,               -- free-text label
  -- For POS lines:
  pos_material_id UUID REFERENCES pos_materials(id),
  quantity NUMERIC(10,2),
  cost_per_unit NUMERIC(10,2),
  -- For non-POS lines, just a flat amount:
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_promo_spend_promo ON promo_trade_spend_lines (promo_id);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
CREATE TRIGGER set_updated_at_skus               BEFORE UPDATE ON skus               FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE TRIGGER set_updated_at_pricing_tiers      BEFORE UPDATE ON pricing_tiers      FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE TRIGGER set_updated_at_pos_materials      BEFORE UPDATE ON pos_materials      FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE TRIGGER set_updated_at_promos_v2          BEFORE UPDATE ON promos_v2          FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE TRIGGER set_updated_at_promo_sku_lines    BEFORE UPDATE ON promo_sku_lines    FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE TRIGGER set_updated_at_promo_spend_lines  BEFORE UPDATE ON promo_trade_spend_lines FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS — readable by all authenticated; writable by managers/directors only.
-- For v1 regional reps are read-only on promos.
-- -----------------------------------------------------------------------------
ALTER TABLE skus                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_tiers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_materials            ENABLE ROW LEVEL SECURITY;
ALTER TABLE promos_v2                ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_sku_lines          ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_trade_spend_lines  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read skus"         ON skus                    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth read pricing"      ON pricing_tiers           FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth read pos"          ON pos_materials           FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth read promos"       ON promos_v2               FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth read promo_lines"  ON promo_sku_lines         FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth read spend_lines"  ON promo_trade_spend_lines FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "mgr write skus" ON skus FOR ALL
  USING (public.current_user_role() IN ('manager', 'director'))
  WITH CHECK (public.current_user_role() IN ('manager', 'director'));
CREATE POLICY "mgr write pricing" ON pricing_tiers FOR ALL
  USING (public.current_user_role() IN ('manager', 'director'))
  WITH CHECK (public.current_user_role() IN ('manager', 'director'));
CREATE POLICY "mgr write pos" ON pos_materials FOR ALL
  USING (public.current_user_role() IN ('manager', 'director'))
  WITH CHECK (public.current_user_role() IN ('manager', 'director'));
CREATE POLICY "mgr write promos" ON promos_v2 FOR ALL
  USING (public.current_user_role() IN ('manager', 'director'))
  WITH CHECK (public.current_user_role() IN ('manager', 'director'));
CREATE POLICY "mgr write promo_lines" ON promo_sku_lines FOR ALL
  USING (public.current_user_role() IN ('manager', 'director'))
  WITH CHECK (public.current_user_role() IN ('manager', 'director'));
CREATE POLICY "mgr write spend_lines" ON promo_trade_spend_lines FOR ALL
  USING (public.current_user_role() IN ('manager', 'director'))
  WITH CHECK (public.current_user_role() IN ('manager', 'director'));

ALTER PUBLICATION supabase_realtime ADD TABLE
  skus, pricing_tiers, pos_materials, promos_v2, promo_sku_lines, promo_trade_spend_lines;
