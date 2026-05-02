# Phase D — Promo Calendar, POS Materials, Pricing Admin

## What's new

1. **Promo Calendar** (`/promos`) — fully rebuilt
   - Gantt-style timeline view, swim lanes by channel
   - Filters: channels, Conventional regions, statuses
   - 1mo / 3mo / 6mo view toggles, prev/next/today navigation
   - Click any promo bar → readonly detail modal with full calc breakdown
   - "+ Add Promo" button (manager/director only) opens full entry form

2. **Promo entry form**
   - Header: name, dates, channel (auto-defaults customer class), regions multi-select for Conventional, owner, status, mechanics note
   - Discount: none / % off / $ off per case / billback per case
   - SKU lines: pick product family + optional flavor + cases. Pricing tier auto-resolved from channel + case count. Tier label shown under each line.
   - Trade spend lines: 8 categories (Coolers, Shelf Clips, Displays, Slotting, Samples, POS, Billback, Other). POS lines pull from the POS Materials catalog (qty × cost auto-calculated).
   - Live calc panel: total cases, gross revenue, discount, gross profit, trade spend (with %), contribution profit

3. **POS Materials admin** (`/pos-materials`) — manager/director-only
   - Catalog of POS items (case stackers, signs, coolers, etc.) used in promo trade spend
   - 10 starter items pre-seeded
   - Add/edit/delete with categories: Display, Signage, Cooler, Premium, Other

4. **Pricing & COGS admin** (`/pricing`) — manager/director-only
   - Edit COGS per unit / per case across all 45 pricing tiers
   - Auto-recomputes per-case COGS when per-unit COGS is changed
   - Margin % column color-coded (green ≥40%, amber 20-40%, rose <20%)
   - Pending edits buffered, batch save with confirm

5. **Director role** added
   - Nick Kemper (Conventional + Inbound)
   - Evan Beard promoted to director (New Distribution + Wholesale + Chains)
   - JR Hernandez promoted to director (eCommerce + Retail Direct)
   - All directors get manager-equivalent write access; regional reps stay read-only on promos for v1

## Math chain (locked in)

```
gross revenue       = sum(line.cases × line.price_per_case)
net revenue         = gross revenue − discount       (billback stays as trade spend, not discount)
gross profit        = net revenue − COGS
contribution profit = gross profit − trade spend
trade spend %       = trade spend ÷ gross revenue
```

## Pricing model

- **Channel → default customer class**: Conv/Inbound/NewDist/Wholesale → Distributor; Chains → Retail Direct; eCommerce → eComm Everyday
- **Auto-tier lookup**: when user enters cases for a SKU, the right pricing bracket (e.g., Retailer 4-11 vs 12-24 vs 25-96) is picked automatically
- 45 pricing tiers seeded across 8 product families:
  Kratom Cans, Kava Cans, Shots Combo, Shots Kratom, Shots Kava,
  Kratom Powder Sticks, Kava Powder Sticks, Draft Kegs
- Plus eComm Everyday/Promoted/Deep Promo and Retail Direct levels

## How to apply

1. Extract this tarball
2. Upload changed files via github.dev (`.` shortcut on github.com)
3. Commit
4. StackBlitz auto-rebuilds

The new tables (`skus`, `pricing_tiers`, `pos_materials`, `promos_v2`, `promo_sku_lines`, `promo_trade_spend_lines`) are seeded in mock mode automatically. For production Supabase, run migrations 003 + seed 003 in order.

## What's next (deferred)

- Promo case volumes auto-cascading to Forecast Grid as Go Get rows when status moves to "approved" (the cascade infrastructure exists from Phase C; needs wiring)
- Regional rep promo drafts → director review workflow
- Pricing tier add/edit/delete (currently only COGS is editable; tier changes require seed edits)
- Promo ROI rollup view (which promos contributed the most? cumulative trade spend by channel?)
