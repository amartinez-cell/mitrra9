-- =============================================================================
-- Mitra-9 Sales Planning & Operations Tool
-- Migration 001: Initial schema
-- =============================================================================
-- Run this in the Supabase SQL editor (or via `supabase db push`) to create
-- all tables, indexes, and row-level security policies.
-- =============================================================================

-- Enable required extensions
create extension if not exists "pgcrypto";

-- =============================================================================
-- PROFILES (extends auth.users)
-- =============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('rep', 'manager', 'viewer')),
  sales_channel text,
  sales_region text,
  email text,
  created_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_channel_idx on public.profiles(sales_channel);

-- =============================================================================
-- ANNUAL PLAN
-- =============================================================================
create table if not exists public.annual_plan (
  id uuid primary key default gen_random_uuid(),
  fiscal_year int not null,
  month int not null check (month between 1 and 12),
  sales_channel text not null,
  planned_revenue numeric(14,2) not null,
  planned_units int,
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique(fiscal_year, month, sales_channel)
);

create index if not exists annual_plan_period_idx on public.annual_plan(fiscal_year, month);

-- =============================================================================
-- FORECAST ENTRIES (rep-level, partner/SKU granularity)
-- =============================================================================
create table if not exists public.forecast_entries (
  id uuid primary key default gen_random_uuid(),
  fiscal_year int not null,
  month int not null check (month between 1 and 12),
  submitted_by uuid not null references public.profiles(id),
  sales_channel text not null,
  customer_name text not null,
  product_category text,
  sku text,
  forecasted_revenue numeric(14,2) not null,
  forecasted_units int,
  confidence text check (confidence in ('high', 'medium', 'low')),
  notes text,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'revised')),
  submitted_at timestamptz,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists forecast_entries_period_idx on public.forecast_entries(fiscal_year, month);
create index if not exists forecast_entries_submitter_idx on public.forecast_entries(submitted_by);
create index if not exists forecast_entries_status_idx on public.forecast_entries(status);
create index if not exists forecast_entries_channel_idx on public.forecast_entries(sales_channel);

-- =============================================================================
-- REFORECAST (channel-level roll-up, manager-approved)
-- =============================================================================
create table if not exists public.reforecast (
  id uuid primary key default gen_random_uuid(),
  fiscal_year int not null,
  month int not null check (month between 1 and 12),
  sales_channel text not null,
  reforecast_revenue numeric(14,2) not null,
  reforecast_units int,
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique(fiscal_year, month, sales_channel)
);

-- Variance is computed on read via a view rather than a generated column,
-- because generated columns can't reference other tables in Postgres.
create or replace view public.reforecast_with_variance as
  select
    r.*,
    ap.planned_revenue,
    (r.reforecast_revenue - coalesce(ap.planned_revenue, 0)) as variance_to_plan,
    case
      when ap.planned_revenue is null or ap.planned_revenue = 0 then null
      else ((r.reforecast_revenue - ap.planned_revenue) / ap.planned_revenue)
    end as variance_to_plan_pct
  from public.reforecast r
  left join public.annual_plan ap
    on ap.fiscal_year = r.fiscal_year
    and ap.month = r.month
    and ap.sales_channel = r.sales_channel;

-- =============================================================================
-- BRIDGE BUCKETS (plan-to-actuals waterfall variance drivers)
-- =============================================================================
create table if not exists public.bridge_buckets (
  id uuid primary key default gen_random_uuid(),
  fiscal_year int not null,
  period_type text not null check (period_type in ('month', 'quarter')),
  period_value int not null,
  bucket_name text not null,
  dollar_impact numeric(14,2) not null,
  units_impact int,
  commentary text,
  sort_order int not null default 0,
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create index if not exists bridge_buckets_period_idx
  on public.bridge_buckets(fiscal_year, period_type, period_value);

-- =============================================================================
-- R&O ITEMS (risks and opportunities)
-- =============================================================================
create table if not exists public.ro_items (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('risk', 'opportunity')),
  description text not null,
  sales_channel text,
  owner uuid references public.profiles(id),
  owner_name text,
  impact_low numeric(14,2),
  impact_mid numeric(14,2),
  impact_high numeric(14,2),
  probability numeric(4,3) check (probability between 0 and 1),
  expected_value numeric(14,2) generated always as
    (coalesce(impact_mid, 0) * coalesce(probability, 0)) stored,
  classification text check (classification in ('base', 'incremental')),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'closed_won', 'closed_lost')),
  next_steps text,
  due_date date,
  linked_initiative_id uuid,
  linked_promo_id uuid,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ro_items_type_idx on public.ro_items(item_type);
create index if not exists ro_items_status_idx on public.ro_items(status);
create index if not exists ro_items_channel_idx on public.ro_items(sales_channel);

-- =============================================================================
-- INITIATIVES (whiteboard + scoring)
-- =============================================================================
create table if not exists public.initiatives (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner uuid references public.profiles(id),
  owner_name text,
  sales_channel text,
  stage text not null default 'idea'
    check (stage in ('idea', 'evaluating', 'approved', 'in_execution', 'complete')),
  revenue_potential numeric(14,2),
  ops_difficulty int check (ops_difficulty between 1 and 5),
  strategic_alignment int check (strategic_alignment between 1 and 5),
  time_to_execute text,
  required_investment numeric(14,2),
  dependencies text,
  confidence_level text check (confidence_level in ('high', 'medium', 'low')),
  composite_score numeric(8,3),
  confidential boolean not null default false,
  linked_ro_id uuid references public.ro_items(id) on delete set null,
  linked_promo_id uuid,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists initiatives_stage_idx on public.initiatives(stage);
create index if not exists initiatives_confidential_idx on public.initiatives(confidential);

-- =============================================================================
-- SCORING WEIGHTS (configurable by managers)
-- =============================================================================
create table if not exists public.scoring_weights (
  id uuid primary key default gen_random_uuid(),
  criterion text not null unique,
  weight numeric(6,3) not null default 1.0,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- PROMOS
-- =============================================================================
create table if not exists public.promos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  channels text[],
  regions text[],
  target_revenue numeric(14,2),
  pricing_mechanics text,
  materials_needed jsonb,
  distributor_requirements text,
  creative_brief_link text,
  status text not null default 'planning'
    check (status in ('planning', 'approved', 'active', 'complete', 'cancelled')),
  owner uuid references public.profiles(id),
  owner_name text,
  linked_initiative_id uuid references public.initiatives(id) on delete set null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists promos_date_idx on public.promos(start_date, end_date);
create index if not exists promos_status_idx on public.promos(status);

-- Now that initiatives and promos both exist, add the cross-reference FK.
alter table public.initiatives
  drop constraint if exists initiatives_linked_promo_id_fkey;
alter table public.initiatives
  add constraint initiatives_linked_promo_id_fkey
  foreign key (linked_promo_id) references public.promos(id) on delete set null;

alter table public.ro_items
  drop constraint if exists ro_items_linked_initiative_id_fkey;
alter table public.ro_items
  add constraint ro_items_linked_initiative_id_fkey
  foreign key (linked_initiative_id) references public.initiatives(id) on delete set null;

alter table public.ro_items
  drop constraint if exists ro_items_linked_promo_id_fkey;
alter table public.ro_items
  add constraint ro_items_linked_promo_id_fkey
  foreign key (linked_promo_id) references public.promos(id) on delete set null;

-- =============================================================================
-- DISTRIBUTOR TARGETS
-- =============================================================================
create table if not exists public.distributor_targets (
  id uuid primary key default gen_random_uuid(),
  fiscal_year int not null,
  month int not null check (month between 1 and 12),
  distributor_name text not null,
  target_revenue numeric(14,2) not null,
  sales_region text,
  managed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(fiscal_year, month, distributor_name)
);

-- =============================================================================
-- MISS IMPACT ASSUMPTIONS
-- =============================================================================
create table if not exists public.miss_impact_assumptions (
  id uuid primary key default gen_random_uuid(),
  assumption_key text not null unique,
  assumption_value numeric(12,4) not null,
  description text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- ACTIVITY LOG
-- =============================================================================
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  user_name text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_entity_idx on public.activity_log(entity_type, entity_id);
create index if not exists activity_log_user_idx on public.activity_log(user_id);
create index if not exists activity_log_created_idx on public.activity_log(created_at desc);

-- =============================================================================
-- COMMENTS (threaded comments on any entity)
-- =============================================================================
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  user_id uuid references public.profiles(id),
  user_name text,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists comments_entity_idx on public.comments(entity_type, entity_id);

-- =============================================================================
-- updated_at TRIGGER
-- =============================================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'annual_plan', 'forecast_entries', 'reforecast', 'bridge_buckets',
    'ro_items', 'initiatives', 'scoring_weights', 'promos',
    'miss_impact_assumptions'
  ])
  loop
    execute format(
      'drop trigger if exists set_updated_at on public.%I;
       create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at();',
      t, t
    );
  end loop;
end $$;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Helper: current user's role
create or replace function public.current_user_role()
returns text as $$
  select role from public.profiles where id = auth.uid();
$$ language sql stable security definer;

-- PROFILES
alter table public.profiles enable row level security;

create policy "profiles_select_all" on public.profiles
  for select using (true);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- ANNUAL PLAN
alter table public.annual_plan enable row level security;

create policy "annual_plan_select_all" on public.annual_plan
  for select using (true);

create policy "annual_plan_manager_write" on public.annual_plan
  for all using (public.current_user_role() = 'manager')
  with check (public.current_user_role() = 'manager');

-- FORECAST ENTRIES
alter table public.forecast_entries enable row level security;

create policy "forecast_entries_select_all" on public.forecast_entries
  for select using (true);

create policy "forecast_entries_insert_own" on public.forecast_entries
  for insert with check (
    auth.uid() = submitted_by
    and public.current_user_role() in ('rep', 'manager')
  );

create policy "forecast_entries_update_own_draft" on public.forecast_entries
  for update using (
    auth.uid() = submitted_by and status = 'draft'
  );

create policy "forecast_entries_manager_all" on public.forecast_entries
  for update using (public.current_user_role() = 'manager');

create policy "forecast_entries_delete_own_draft" on public.forecast_entries
  for delete using (
    auth.uid() = submitted_by and status = 'draft'
  );

-- REFORECAST (managers only write, all can read)
alter table public.reforecast enable row level security;

create policy "reforecast_select_all" on public.reforecast
  for select using (true);

create policy "reforecast_manager_write" on public.reforecast
  for all using (public.current_user_role() = 'manager')
  with check (public.current_user_role() = 'manager');

-- BRIDGE BUCKETS
alter table public.bridge_buckets enable row level security;

create policy "bridge_select_all" on public.bridge_buckets for select using (true);
create policy "bridge_manager_write" on public.bridge_buckets
  for all using (public.current_user_role() = 'manager')
  with check (public.current_user_role() = 'manager');

-- R&O ITEMS
alter table public.ro_items enable row level security;

create policy "ro_select_all" on public.ro_items for select using (true);
create policy "ro_manager_write" on public.ro_items
  for all using (public.current_user_role() = 'manager')
  with check (public.current_user_role() = 'manager');

-- INITIATIVES — confidential items only visible to managers
alter table public.initiatives enable row level security;

create policy "initiatives_select_visible" on public.initiatives
  for select using (
    not confidential or public.current_user_role() = 'manager'
  );

create policy "initiatives_insert_any_user" on public.initiatives
  for insert with check (
    public.current_user_role() in ('rep', 'manager')
  );

create policy "initiatives_manager_update" on public.initiatives
  for update using (public.current_user_role() = 'manager');

create policy "initiatives_owner_update_idea" on public.initiatives
  for update using (
    auth.uid() = created_by and stage in ('idea', 'evaluating')
  );

-- SCORING WEIGHTS
alter table public.scoring_weights enable row level security;

create policy "weights_select_all" on public.scoring_weights for select using (true);
create policy "weights_manager_write" on public.scoring_weights
  for all using (public.current_user_role() = 'manager')
  with check (public.current_user_role() = 'manager');

-- PROMOS
alter table public.promos enable row level security;

create policy "promos_select_all" on public.promos for select using (true);
create policy "promos_manager_write" on public.promos
  for all using (public.current_user_role() = 'manager')
  with check (public.current_user_role() = 'manager');

-- DISTRIBUTOR TARGETS
alter table public.distributor_targets enable row level security;

create policy "dist_targets_select_all" on public.distributor_targets for select using (true);
create policy "dist_targets_manager_write" on public.distributor_targets
  for all using (public.current_user_role() = 'manager')
  with check (public.current_user_role() = 'manager');

-- MISS IMPACT ASSUMPTIONS
alter table public.miss_impact_assumptions enable row level security;

create policy "miss_select_all" on public.miss_impact_assumptions for select using (true);
create policy "miss_manager_write" on public.miss_impact_assumptions
  for all using (public.current_user_role() = 'manager')
  with check (public.current_user_role() = 'manager');

-- ACTIVITY LOG (insert-only for all authenticated; select for all)
alter table public.activity_log enable row level security;

create policy "activity_select_all" on public.activity_log for select using (true);
create policy "activity_insert_any" on public.activity_log
  for insert with check (auth.uid() is not null);

-- COMMENTS — any authenticated user can read and write
alter table public.comments enable row level security;

create policy "comments_select_all" on public.comments for select using (true);
create policy "comments_insert_any" on public.comments
  for insert with check (auth.uid() = user_id);
create policy "comments_update_own" on public.comments
  for update using (auth.uid() = user_id);
create policy "comments_delete_own" on public.comments
  for delete using (auth.uid() = user_id);

-- =============================================================================
-- REALTIME
-- =============================================================================
-- Enable realtime on the tables the dashboard subscribes to.
alter publication supabase_realtime add table public.forecast_entries;
alter publication supabase_realtime add table public.ro_items;
alter publication supabase_realtime add table public.initiatives;
alter publication supabase_realtime add table public.promos;
alter publication supabase_realtime add table public.bridge_buckets;
alter publication supabase_realtime add table public.activity_log;
alter publication supabase_realtime add table public.comments;
