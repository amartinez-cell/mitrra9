import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { MOCK_USERS } from '../data/mockUsers'

const AuthContext = createContext(null)

const DEMO_USER_KEY = 'mitra9_demo_user_id'

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Restore session
  useEffect(() => {
    let mounted = true

    async function init() {
      if (isSupabaseConfigured) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()
          if (mounted && data) setProfile(data)
        }
      } else {
        // Demo mode — persist selected user in localStorage
        const stored = localStorage.getItem(DEMO_USER_KEY)
        if (stored) {
          const u = MOCK_USERS.find((x) => x.id === stored)
          if (u) setProfile(u)
        }
      }
      if (mounted) setLoading(false)
    }

    init()

    let sub
    if (isSupabaseConfigured) {
      sub = supabase.auth.onAuthStateChange(async (_ev, session) => {
        if (!session?.user) return setProfile(null)
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
        setProfile(data || null)
      })
    }

    return () => {
      mounted = false
      sub?.data?.subscription?.unsubscribe?.()
    }
  }, [])

  const signIn = useCallback(async ({ email, password, demoUserId }) => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      return
    }
    // Demo mode
    const u = MOCK_USERS.find((x) => x.id === demoUserId || x.email === email)
    if (!u) throw new Error('User not found')
    localStorage.setItem(DEMO_USER_KEY, u.id)
    setProfile(u)
  }, [])

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) await supabase.auth.signOut()
    else localStorage.removeItem(DEMO_USER_KEY)
    setProfile(null)
  }, [])

  const value = {
    profile,
    loading,
    signIn,
    signOut,
    isManager: profile?.role === 'manager',
    isRep: profile?.role === 'rep',
    isViewer: profile?.role === 'viewer',
    canWrite: profile?.role === 'manager' || profile?.role === 'rep',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
