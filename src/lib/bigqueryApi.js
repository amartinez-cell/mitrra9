/**
 * Read-only client for the BigQuery middleware. In dev/demo this hits the
 * Express stub at /api/actuals/*; in prod it will hit the real BigQuery
 * service-account-backed endpoint.
 *
 * If the stub is unreachable (e.g. user hasn't started the api server),
 * every call gracefully falls back to local mock data from ./mockActuals.
 */

import { MOCK_ACTUALS } from '../data/mockActuals'

const BASE = import.meta.env.VITE_BIGQUERY_API_URL || ''

async function safeFetch(path, params = {}) {
  // No API base → skip the fetch entirely and let the caller fall back to mock.
  if (!BASE) return null

  const qs = new URLSearchParams(params).toString()
  const url = `${BASE}${path}${qs ? `?${qs}` : ''}`
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn(`[bigquery stub] ${path} failed, using mock:`, err.message)
    return null
  }
}

export async function fetchRevenueSummary(fiscal_year, month) {
  return (
    (await safeFetch('/api/actuals/revenue', { fiscal_year, month })) ||
    MOCK_ACTUALS.revenueSummary(fiscal_year, month)
  )
}

export async function fetchByChannel(fiscal_year, month) {
  return (
    (await safeFetch('/api/actuals/by-channel', { fiscal_year, month })) ||
    MOCK_ACTUALS.byChannel(fiscal_year, month)
  )
}

export async function fetchByDistributor(fiscal_year, month) {
  return (
    (await safeFetch('/api/actuals/by-distributor', { fiscal_year, month })) ||
    MOCK_ACTUALS.byDistributor(fiscal_year, month)
  )
}

export async function fetchByProduct(fiscal_year, month) {
  return (
    (await safeFetch('/api/actuals/by-product', { fiscal_year, month })) ||
    MOCK_ACTUALS.byProduct(fiscal_year, month)
  )
}

export async function fetchDailyPacing(fiscal_year, month) {
  return (
    (await safeFetch('/api/actuals/daily-pacing', { fiscal_year, month })) ||
    MOCK_ACTUALS.dailyPacing(fiscal_year, month)
  )
}

export async function fetchTrend(fiscal_year, month, months = 6) {
  return (
    (await safeFetch('/api/actuals/trend', { fiscal_year, month, months })) ||
    MOCK_ACTUALS.trend(fiscal_year, month, months)
  )
}
