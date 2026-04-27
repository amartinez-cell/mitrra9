/**
 * useForecastGrid — given the relevant tables and a fiscal year, returns:
 *   sections: [{ key, channel, region, label, rows, subtotalsByMonth, ... }]
 *   monthly totals, grand total, plan totals, variance.
 *
 * Sections:
 *   - Conventional gets one section per region (Florida, North, West, East, South)
 *   - Other channels (Inbound, New Distribution, Wholesale, Chains) get one each
 *
 * Each section has:
 *   - partner rows (row_kind = 'partner')
 *   - 'Other' row (row_kind = 'other')
 *   - subtotal (partner + Other)
 *   - 'Go Gets' rows (R&O incremental opportunities tied to this section, generated from ro_items)
 *   - subtotal + Go Gets
 *   - MTD landed line (read from current-month actuals)
 */

import { useMemo } from 'react'
import { useTable } from '../../hooks/useTable'
import { CHANNEL_ORDER, REGION_ORDER, FY, DEMO_CURRENT_MONTH } from './helpers'

export function useForecastGrid({ fiscalYear = FY, currentMonth = DEMO_CURRENT_MONTH, mtdActualsByDistributor = {} } = {}) {
  const { rows: distributors }    = useTable('distributors')
  const { rows: targets }          = useTable('distributor_targets')
  const { rows: yearlyTargets }    = useTable('distributor_yearly_targets')
  const { rows: forecastCells }    = useTable('forecast_cells')
  const { rows: regions }          = useTable('regions')
  const { rows: roItems }          = useTable('ro_items')

  return useMemo(() => {
    // Index everything for fast lookup
    const cellByKey = new Map()      // (distId|year|month) -> forecast_cell
    for (const c of forecastCells) {
      if (c.fiscal_year !== fiscalYear) continue
      cellByKey.set(`${c.distributor_id}|${c.month}`, c)
    }

    const targetByKey = new Map()    // (distId|month) -> target row
    for (const t of targets) {
      if (t.fiscal_year !== fiscalYear) continue
      targetByKey.set(`${t.distributor_id}|${t.month}`, t)
    }

    const yearlyByDist = new Map()
    for (const y of yearlyTargets) {
      if (y.fiscal_year !== fiscalYear) continue
      yearlyByDist.set(y.distributor_id, y.yearly_estimate)
    }

    const regionById = new Map(regions.map((r) => [r.id, r]))

    // Sort distributors into buckets
    const conventional = distributors
      .filter((d) => d.channel === 'Conventional' && d.active !== false)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

    const byRegion = {}
    for (const d of conventional) {
      const region = regionById.get(d.region_id)?.name || 'Unassigned'
      if (!byRegion[region]) byRegion[region] = []
      byRegion[region].push(d)
    }

    const conventionalSections = REGION_ORDER
      .filter((r) => byRegion[r])
      .map((regionName) => {
        const dists = byRegion[regionName]
        return buildSection({
          key: `conv-${regionName}`,
          channel: 'Conventional',
          region: regionName,
          label: regionName,
          distributors: dists,
          cellByKey,
          targetByKey,
          yearlyByDist,
          mtdActualsByDistributor,
          fiscalYear,
          currentMonth,
          regionLeadName: getRegionLead(dists),
          roItems,
        })
      })

    // Non-conventional channels — single section each, no region split
    const nonConvSections = CHANNEL_ORDER
      .filter((ch) => ch !== 'Conventional')
      .map((channel) => {
        const dists = distributors
          .filter((d) => d.channel === channel && d.active !== false)
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        if (dists.length === 0) return null
        return buildSection({
          key: `ch-${channel}`,
          channel,
          region: null,
          label: channel,
          distributors: dists,
          cellByKey,
          targetByKey,
          yearlyByDist,
          mtdActualsByDistributor,
          fiscalYear,
          currentMonth,
          regionLeadName: null,
          roItems,
        })
      })
      .filter(Boolean)

    const sections = [...conventionalSections, ...nonConvSections]

    // Grand totals across all sections
    const grandTotals = emptyTotals()
    for (const sect of sections) {
      for (let m = 1; m <= 12; m++) {
        grandTotals.byMonth[m] += sect.subtotalsWithGoGets.byMonth[m]
        grandTotals.targetByMonth[m] += sect.subtotalsWithGoGets.targetByMonth[m]
      }
      grandTotals.reforecastTotal += sect.subtotalsWithGoGets.reforecastTotal
      grandTotals.targetTotal += sect.subtotalsWithGoGets.targetTotal
    }
    grandTotals.varDollar = grandTotals.reforecastTotal - grandTotals.targetTotal
    grandTotals.varPct = grandTotals.targetTotal ? grandTotals.varDollar / grandTotals.targetTotal : null

    // Channel-level totals (e.g. "Conventional Subtotal")
    const channelTotals = {}
    for (const ch of CHANNEL_ORDER) {
      channelTotals[ch] = emptyTotals()
      for (const sect of sections) {
        if (sect.channel === ch) {
          for (let m = 1; m <= 12; m++) {
            channelTotals[ch].byMonth[m] += sect.subtotalsWithGoGets.byMonth[m]
            channelTotals[ch].targetByMonth[m] += sect.subtotalsWithGoGets.targetByMonth[m]
          }
          channelTotals[ch].reforecastTotal += sect.subtotalsWithGoGets.reforecastTotal
          channelTotals[ch].targetTotal += sect.subtotalsWithGoGets.targetTotal
        }
      }
      channelTotals[ch].varDollar = channelTotals[ch].reforecastTotal - channelTotals[ch].targetTotal
      channelTotals[ch].varPct = channelTotals[ch].targetTotal ? channelTotals[ch].varDollar / channelTotals[ch].targetTotal : null
    }

    return { sections, channelTotals, grandTotals, fiscalYear, currentMonth }
  }, [distributors, targets, yearlyTargets, forecastCells, regions, roItems, mtdActualsByDistributor, fiscalYear, currentMonth])
}

function getRegionLead(dists) {
  // Use the first distributor's owner_rep_id... cheap heuristic
  const ids = dists.map((d) => d.owner_rep_id).filter(Boolean)
  if (!ids.length) return null
  // Most common
  const counts = {}
  ids.forEach((id) => { counts[id] = (counts[id] || 0) + 1 })
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

function buildSection({
  key, channel, region, label, distributors,
  cellByKey, targetByKey, yearlyByDist, mtdActualsByDistributor,
  fiscalYear, currentMonth, regionLeadName, roItems,
}) {
  const partnerRows = []
  const otherRows = []
  for (const d of distributors) {
    const row = buildRow(d, cellByKey, targetByKey, yearlyByDist, mtdActualsByDistributor, fiscalYear, currentMonth)
    if (d.row_kind === 'other') otherRows.push(row)
    else partnerRows.push(row)
  }

  // Partner subtotals
  const partnerSubtotals = sumRows([...partnerRows, ...otherRows])

  // Go Gets are the R&O incremental opportunities scoped to this section
  // (matched by channel + region or just channel for non-conventional)
  const goGetItems = roItems.filter((r) => {
    if (r.classification !== 'incremental') return false
    if (r.item_type !== 'opportunity') return false
    if (channel === 'Conventional') {
      return r.sales_channel === 'Conventional' && (r.sales_region === region || !r.sales_region)
    }
    return r.sales_channel === channel
  })

  // Synthesize a row per Go Get using R&O EV / month buckets if present
  const goGetRows = goGetItems.map((r) => synthesizeGoGetRow(r, fiscalYear, currentMonth))

  // Sub + Go Gets
  const subtotalsWithGoGets = sumRows([...partnerRows, ...otherRows, ...goGetRows])

  // MTD Landed for the current month — sum of mtdActualsByDistributor across our distributors
  const mtdLanded = distributors.reduce((s, d) => s + (mtdActualsByDistributor[d.id] || 0), 0)

  return {
    key, channel, region, label,
    regionLeadName,
    partnerRows,
    otherRows,
    goGetRows,
    partnerSubtotals,
    subtotalsWithGoGets,
    mtdLanded,
  }
}

function buildRow(distributor, cellByKey, targetByKey, yearlyByDist, mtdActualsByDistributor, fiscalYear, currentMonth) {
  const months = []
  let reforecastTotal = 0
  let targetTotal = 0
  for (let m = 1; m <= 12; m++) {
    const cell = cellByKey.get(`${distributor.id}|${m}`)
    const tgt = targetByKey.get(`${distributor.id}|${m}`)
    const forecasted = Number(cell?.forecasted_revenue || 0)
    const target = Number(tgt?.target_revenue || 0)
    months.push({
      month: m,
      cell,
      forecasted,
      target,
    })
    reforecastTotal += forecasted
    targetTotal += target
  }

  return {
    distributor,
    months,
    mtdActual: mtdActualsByDistributor[distributor.id] || 0,
    reforecastTotal,
    targetTotal,
    yearlyEstimate: yearlyByDist.get(distributor.id) || 0,
    varDollar: reforecastTotal - targetTotal,
    varPct: targetTotal ? (reforecastTotal - targetTotal) / targetTotal : null,
  }
}

function synthesizeGoGetRow(roItem, fiscalYear, currentMonth) {
  // Spread the R&O's expected_value evenly across remaining months of FY
  const ev = Number(roItem.impact_mid || 0) * Number(roItem.probability || 0)
  const remainingMonths = Math.max(1, 12 - currentMonth + 1)
  const perMonth = ev / remainingMonths

  const months = []
  let reforecastTotal = 0
  for (let m = 1; m <= 12; m++) {
    const forecasted = m >= currentMonth ? perMonth : 0
    months.push({ month: m, forecasted, target: 0 })
    reforecastTotal += forecasted
  }
  return {
    distributor: {
      id: `ro-${roItem.id}`,
      name: roItem.description,
      lead_name: roItem.owner_name,
      row_kind: 'go_get',
    },
    months,
    mtdActual: 0,
    reforecastTotal,
    targetTotal: 0,
    yearlyEstimate: 0,
    varDollar: reforecastTotal,
    varPct: null,
    isGoGet: true,
    roItem,
  }
}

function emptyTotals() {
  const byMonth = {}
  const targetByMonth = {}
  for (let m = 1; m <= 12; m++) { byMonth[m] = 0; targetByMonth[m] = 0 }
  return { byMonth, targetByMonth, reforecastTotal: 0, targetTotal: 0, varDollar: 0, varPct: null }
}

function sumRows(rows) {
  const t = emptyTotals()
  for (const row of rows) {
    for (const m of row.months) {
      t.byMonth[m.month] += m.forecasted
      t.targetByMonth[m.month] += m.target
    }
    t.reforecastTotal += row.reforecastTotal
    t.targetTotal += row.targetTotal
  }
  t.varDollar = t.reforecastTotal - t.targetTotal
  t.varPct = t.targetTotal ? t.varDollar / t.targetTotal : null
  return t
}
