// app/api/users/update/route.ts
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  const { userId, name, username, password, role } = await req.json()

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
  )

  // Allow master or self
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const { data: caller } = await supabase.from('app_users').select('role').eq('id', session.user.id).single()
  const isSelf = session.user.id === userId
  if (caller?.role !== 'master' && !isSelf) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  // Update auth password if provided
  if (password && password.trim()) {
    const { error } = await supabase.auth.admin.updateUserById(userId, { password })
    if (error) return NextResponse.json({ ok: false, error: error.message })
  }

  // Update email if username changed
  const newEmail = `${username.toLowerCase()}@mrdiy.internal`
  await supabase.auth.admin.updateUserById(userId, { email: newEmail })

  // Update profile
  const { error: profileErr } = await supabase.from('app_users').update({ name, username, role }).eq('id', userId)
  if (profileErr) return NextResponse.json({ ok: false, error: profileErr.message })

  return NextResponse.json({ ok: true })
}
