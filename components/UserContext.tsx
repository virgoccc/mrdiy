'use client'
// components/UserContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createClient } from '@/lib/supabase'
import { AppUser } from '@/types'

interface UserContextType {
  user: AppUser | null
  loading: boolean
  refresh: () => void
}

const UserContext = createContext<UserContextType>({ user: null, loading: true, refresh: () => {} })

export function UserProvider({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setUser(null); setLoading(false); return }
    const { data } = await supabase.from('app_users').select('*').eq('id', session.user.id).single()
    setUser(data || null); setLoading(false)
  }

  useEffect(() => { load() }, [])

  return <UserContext.Provider value={{ user, loading, refresh: load }}>{children}</UserContext.Provider>
}

export const useUser = () => useContext(UserContext)
