// app/api/users/delete/route.ts
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  const { userId } = await req.json()

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
  )

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const { data: caller } = await supabase.from('app_users').select('role').eq('id', session.user.id).single()
  if (caller?.role !== 'master') return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  // Prevent deleting self
  if (session.user.id === userId) return NextResponse.json({ ok: false, error: 'Cannot delete yourself' })

  // Delete from auth (cascades to app_users via FK)
  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ ok: false, error: error.message })

  return NextResponse.json({ ok: true })
}
