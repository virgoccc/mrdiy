// app/api/users/create/route.ts
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  const { name, username, password, role } = await req.json()

  const cookieStore = cookies()
  // Use service role for admin actions
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
  )

  // Verify caller is master
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const { data: caller } = await supabase.from('app_users').select('role').eq('id', session.user.id).single()
  if (caller?.role !== 'master') return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  // Check username unique
  const { data: existing } = await supabase.from('app_users').select('id').eq('username', username).single()
  if (existing) return NextResponse.json({ ok: false, error: 'Username already exists' })

  // Create Supabase Auth user with email convention
  const email = `${username.toLowerCase()}@mrdiy.internal`
  const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({ email, password, email_confirm: true })
  if (authErr) return NextResponse.json({ ok: false, error: authErr.message })

  // Insert app_users profile
  const { error: profileErr } = await supabase.from('app_users').insert({ id: authUser.user.id, name, username, role })
  if (profileErr) {
    await supabase.auth.admin.deleteUser(authUser.user.id)
    return NextResponse.json({ ok: false, error: profileErr.message })
  }

  return NextResponse.json({ ok: true })
}
