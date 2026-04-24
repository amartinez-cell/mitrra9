import { useEffect, useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { mockStore } from '../data/mockStore'

/**
 * useTable(name) — returns {rows, loading, error, refresh} for a table.
 * Auto-subscribes to changes in both demo mode (mockStore subscribe) and
 * live mode (Supabase realtime).
 */
export function useTable(table, { order } = {}) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    if (isSupabaseConfigured) {
      let q = supabase.from(table).select('*')
      if (order) q = q.order(order.column, { ascending: order.ascending ?? true })
      const { data, error } = await q
      if (error) setError(error)
      else setRows(data || [])
    } else {
      let data = mockStore.list(table)
      if (order) {
        const { column, ascending = true } = order
        data = [...data].sort((a, b) => {
          const av = a[column], bv = b[column]
          if (av == null && bv == null) return 0
          if (av == null) return ascending ? 1 : -1
          if (bv == null) return ascending ? -1 : 1
          if (av < bv) return ascending ? -1 : 1
          if (av > bv) return ascending ? 1 : -1
          return 0
        })
      }
      setRows(data)
    }
    setLoading(false)
  }, [table, order?.column, order?.ascending])

  useEffect(() => {
    refresh()
    if (isSupabaseConfigured) {
      const ch = supabase
        .channel(`rt-${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, refresh)
        .subscribe()
      return () => { supabase.removeChannel(ch) }
    }
    return mockStore.subscribe((t) => { if (t === table) refresh() })
  }, [table, refresh])

  return { rows, loading, error, refresh }
}

// -----------------------------------------------------------------------------
// Write helpers — route to Supabase or mockStore. User is required for the
// activity log in demo mode (Supabase relies on auth.uid()).
// -----------------------------------------------------------------------------

export async function insertRow(table, values, user) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from(table).insert(values).select().single()
    if (error) throw error
    return data
  }
  const row = mockStore.insert(table, values)
  if (user) mockStore.log('created', table, row.id, values, user)
  return row
}

export async function updateRow(table, id, values, user) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from(table).update(values).eq('id', id).select().single()
    if (error) throw error
    return data
  }
  const row = mockStore.update(table, id, values)
  if (user) mockStore.log('updated', table, id, values, user)
  return row
}

export async function deleteRow(table, id, user) {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) throw error
    return
  }
  mockStore.remove(table, id)
  if (user) mockStore.log('deleted', table, id, {}, user)
}
