/**
 * Export the current forecast grid state to an .xlsx file.
 *
 * The output structure mirrors Book3.xlsx (B2B Monthly Reforecast):
 *   - Header row with Distribution Partner, Lead, MTD, then 12 months, then Total/Plan/Var
 *   - Per-section: region/channel divider row, partner rows, Other, Subtotal,
 *     Go Gets rows (if any), Subtotal + Go Gets
 *   - Channel-level subtotal rows
 *   - Grand total at the bottom
 *
 * Uses SheetJS via the CDN tarball pinned in package.json.
 */

import * as XLSX from 'xlsx'
import { MONTH_NAMES, FY } from './helpers'

export function exportForecastToXlsx({ sections, channelTotals, grandTotals, fiscalYear = FY }) {
  const aoa = []   // array of arrays — what we'll feed into the sheet
  const merges = []
  const styleHints = []  // tracks which row indices are headers / subtotals (used downstream if we want to apply formatting)

  // Top header
  const headerRow = [
    'Distribution Partner', 'Lead', 'MTD',
    ...MONTH_NAMES.map((m) => `${m}-${String(fiscalYear).slice(2)}`),
    'Reforecast', 'Plan', 'Var $', 'Var %',
  ]
  aoa.push([`FY${fiscalYear} Monthly Reforecast`])
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: headerRow.length - 1 } })
  aoa.push([])  // blank
  aoa.push(headerRow)
  styleHints.push({ row: aoa.length - 1, kind: 'headerRow' })

  // Track which channel we last printed
  let lastChannel = null

  for (const sect of sections) {
    // Channel divider row
    if (sect.channel !== lastChannel) {
      // Channel subtotal of the *previous* channel goes before the new divider
      if (lastChannel) {
        const ct = channelTotals[lastChannel]
        if (ct) {
          aoa.push([
            `${lastChannel} Subtotal`,
            '', '',
            ...monthCells(ct.byMonth),
            ct.reforecastTotal, ct.targetTotal, ct.varDollar, formatPct(ct.varPct),
          ])
          styleHints.push({ row: aoa.length - 1, kind: 'channelSubtotal' })
        }
      }

      aoa.push([sect.channel])
      styleHints.push({ row: aoa.length - 1, kind: 'channelHeader' })
      merges.push({ s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: headerRow.length - 1 } })
      lastChannel = sect.channel
    }

    // Section (region) header
    aoa.push([sect.label])
    styleHints.push({ row: aoa.length - 1, kind: 'sectionHeader' })
    merges.push({ s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: headerRow.length - 1 } })

    // Partner rows
    for (const row of sect.partnerRows) {
      aoa.push(distributorAoaRow(row))
    }
    // Other row(s)
    for (const row of sect.otherRows) {
      aoa.push(distributorAoaRow(row))
    }
    // Subtotal
    aoa.push([
      `${sect.label} Subtotal`,
      '', '',
      ...monthCells(sect.partnerSubtotals.byMonth),
      sect.partnerSubtotals.reforecastTotal,
      sect.partnerSubtotals.targetTotal,
      sect.partnerSubtotals.varDollar,
      formatPct(sect.partnerSubtotals.varPct),
    ])
    styleHints.push({ row: aoa.length - 1, kind: 'subtotal' })

    // MTD landed (only if non-zero)
    if (sect.mtdLanded > 0) {
      const mtdRow = ['MTD Landed', '', sect.mtdLanded]
      while (mtdRow.length < headerRow.length) mtdRow.push('')
      aoa.push(mtdRow)
      styleHints.push({ row: aoa.length - 1, kind: 'mtd' })
    }

    // Go Gets
    if (sect.goGetRows.length) {
      aoa.push(['Go Gets'])
      styleHints.push({ row: aoa.length - 1, kind: 'goGetHeader' })
      merges.push({ s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: headerRow.length - 1 } })

      for (const row of sect.goGetRows) {
        aoa.push(distributorAoaRow(row))
      }

      // Subtotal + Go Gets
      aoa.push([
        `${sect.label} + Go Gets`,
        '', '',
        ...monthCells(sect.subtotalsWithGoGets.byMonth),
        sect.subtotalsWithGoGets.reforecastTotal,
        sect.subtotalsWithGoGets.targetTotal,
        sect.subtotalsWithGoGets.varDollar,
        formatPct(sect.subtotalsWithGoGets.varPct),
      ])
      styleHints.push({ row: aoa.length - 1, kind: 'subtotalStrong' })
    }

    aoa.push([])  // blank spacer between sections
  }

  // Final channel subtotal for the last channel
  if (lastChannel) {
    const ct = channelTotals[lastChannel]
    if (ct) {
      aoa.push([
        `${lastChannel} Subtotal`,
        '', '',
        ...monthCells(ct.byMonth),
        ct.reforecastTotal, ct.targetTotal, ct.varDollar, formatPct(ct.varPct),
      ])
      styleHints.push({ row: aoa.length - 1, kind: 'channelSubtotal' })
    }
  }

  aoa.push([])
  // Grand total
  aoa.push([
    'GRAND TOTAL', '', '',
    ...monthCells(grandTotals.byMonth),
    grandTotals.reforecastTotal,
    grandTotals.targetTotal,
    grandTotals.varDollar,
    formatPct(grandTotals.varPct),
  ])
  styleHints.push({ row: aoa.length - 1, kind: 'grandTotal' })

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!merges'] = merges

  // Column widths roughly matching the on-screen grid
  ws['!cols'] = [
    { wch: 36 },                 // partner
    { wch: 18 },                 // lead
    { wch: 12 },                 // mtd
    ...Array(12).fill({ wch: 11 }),  // months
    { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 9 },  // Reforecast/Plan/Var $/Var %
  ]

  // Apply currency number-format to the data cells.
  // SheetJS community build doesn't apply true cell styles, but it preserves the `z`
  // (number format) so Excel/Sheets renders them as currency.
  applyNumberFormats(ws, aoa, styleHints, headerRow.length)

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Reforecast')

  // Add a separate sheet with the dp_targets master data
  const targetsSheet = buildTargetsSheet({ sections, channelTotals, grandTotals })
  XLSX.utils.book_append_sheet(wb, targetsSheet, 'dp_targets')

  // Trigger download in the browser
  const filename = `Mitra9_Reforecast_FY${fiscalYear}_${todayStamp()}.xlsx`
  XLSX.writeFile(wb, filename)
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function distributorAoaRow(row) {
  const d = row.distributor
  return [
    d.name,
    d.lead_name || '',
    row.mtdActual || 0,
    ...row.months.map((m) => m.forecasted || 0),
    row.reforecastTotal,
    row.targetTotal,
    row.varDollar,
    formatPct(row.varPct),
  ]
}

function monthCells(byMonth) {
  return Array.from({ length: 12 }).map((_, i) => byMonth[i + 1] || 0)
}

function formatPct(p) {
  if (p == null || isNaN(p)) return ''
  return p   // raw decimal — applyNumberFormats will set 0% format on the column
}

function todayStamp() {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function applyNumberFormats(ws, aoa, styleHints, ncols) {
  // Number columns: index 2 (MTD) through ncols-2 (Var $). Last column (Var %) is percent.
  // Apply $#,##0 to dollar columns when the cell value is a number.
  for (let r = 0; r < aoa.length; r++) {
    for (let c = 2; c < ncols; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      const cell = ws[addr]
      if (!cell || cell.t !== 'n') continue
      if (c === ncols - 1) {
        cell.z = '0%'                      // Var %
      } else {
        cell.z = '$#,##0;[Red]$(#,##0);-'   // dollars; show – for zero
      }
    }
  }
}

function buildTargetsSheet({ sections }) {
  // Mirrors Book4 dp_targets shape:
  // Distributor Name | Lead | Regional Assignee | Yearly Estimate | Jan..Dec
  const rows = [
    ['Distributor Name', 'Lead Name', 'Regional Assignee', 'Yearly Estimate',
      ...MONTH_NAMES],
  ]
  for (const sect of sections) {
    for (const row of [...sect.partnerRows, ...sect.otherRows]) {
      const d = row.distributor
      rows.push([
        d.name,
        d.lead_name || '',
        sect.region || sect.channel,
        row.targetTotal,
        ...row.months.map((m) => m.target || 0),
      ])
    }
  }
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [
    { wch: 36 }, { wch: 18 }, { wch: 18 }, { wch: 14 },
    ...Array(12).fill({ wch: 11 }),
  ]
  // Apply currency formatting to the numeric columns
  for (let r = 1; r < rows.length; r++) {
    for (let c = 3; c < rows[r].length; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      const cell = ws[addr]
      if (cell && cell.t === 'n') cell.z = '$#,##0'
    }
  }
  return ws
}
