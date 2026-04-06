'use client'
import Btn from '@/components/Btn'
// app/dashboard/settings/page.tsx
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { AppUser } from '@/types'

export default function SettingsPage() {
  const supabase = createClient()
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null)
  const [users, setUsers] = useState<AppUser[]>([])
  const [tgToken, setTgToken] = useState('')
  const [tgChatId, setTgChatId] = useState('')
  const [tgActive, setTgActive] = useState(false)
  const [showUserModal, setShowUserModal] = useState(false)
  const [editUser, setEditUser] = useState<AppUser | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [shareLinks, setShareLinks] = useState<any[]>([])

  // User form
  const [uName, setUName] = useState('')
  const [uUsername, setUUsername] = useState('')
  const [uPassword, setUPassword] = useState('')
  const [uRole, setURole] = useState<'team' | 'client'>('team')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data: cu } = await supabase.from('app_users').select('*').eq('id', session.user.id).single()
    setCurrentUser(cu)
    const { data: allusers } = await supabase.from('app_users').select('*').order('created_at')
    setUsers(allusers || [])
    const { data: cfg } = await supabase.from('telegram_config').select('*').eq('id', 1).single()
    const { data: links } = await supabase.from('share_tokens').select('*').order('created_at', { ascending: false })
    setShareLinks(links || [])
    if (cfg) { setTgToken(cfg.token || ''); setTgChatId(cfg.chat_id || ''); setTgActive(!!(cfg.token && cfg.chat_id)) }
  }

  function showToast(msg: string, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  async function saveTg() {
    if (!tgToken || !tgChatId) { showToast('Enter both Token and Chat ID', 'danger'); return }
    const { error } = await supabase.from('telegram_config').update({ token: tgToken, chat_id: tgChatId, updated_at: new Date().toISOString() }).eq('id', 1)
    if (error) { showToast('Error saving config', 'danger'); return }
    setTgActive(true)
    // Send test
    try {
      const r = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tgChatId, text: '🔧 *MR DIY Job Tracker*\n\n✅ Bot connected! Notifications are now active.', parse_mode: 'Markdown' })
      })
      const d = await r.json()
      if (d.ok) showToast('✅ Saved! Test message sent to Telegram.')
      else showToast(`⚠️ Saved but Telegram error: ${d.description}`, 'danger')
    } catch { showToast('⚠️ Saved but could not reach Telegram', 'danger') }
  }

  async function clearTg() {
    await supabase.from('telegram_config').update({ token: '', chat_id: '' }).eq('id', 1)
    setTgToken(''); setTgChatId(''); setTgActive(false)
    showToast('Telegram config cleared', 'info')
  }

  function openAddUser() {
    setEditUser(null); setUName(''); setUUsername(''); setUPassword(''); setURole('team')
    setShowUserModal(true)
  }

  function openEditUser(u: AppUser) {
    setEditUser(u); setUName(u.name); setUUsername(u.username); setUPassword('')
    setURole(u.role === 'master' ? 'team' : u.role as 'team' | 'client')
    setShowUserModal(true)
  }

  async function saveUser() {
    if (!uName.trim() || !uUsername.trim() || !uPassword.trim()) { showToast('All fields required', 'danger'); return }

    if (editUser) {
      // Update password in Supabase Auth (requires admin — we use service role via API route)
      const res = await fetch('/api/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: editUser.id, name: uName, username: uUsername, password: uPassword, role: editUser.role === 'master' ? 'master' : uRole })
      })
      const result = await res.json()
      if (!result.ok) { showToast(result.error || 'Error updating user', 'danger'); return }
      showToast('✅ User updated!')
    } else {
      // Create new user
      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: uName, username: uUsername, password: uPassword, role: uRole })
      })
      const result = await res.json()
      if (!result.ok) { showToast(result.error || 'Error creating user', 'danger'); return }
      showToast(`✅ User "${uName}" added!`)
    }
    setShowUserModal(false)
    loadAll()
  }

  async function deleteUser(id: string) {
    if (!confirm('Remove this user?')) return
    const res = await fetch('/api/users/delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id })
    })
    const result = await res.json()
    if (!result.ok) { showToast('Error removing user', 'danger'); return }
    setUsers(prev => prev.filter(u => u.id !== id))
    showToast('🗑️ User removed', 'info')
  }

  const roleStyle = { master: { bg: '#FFD600', color: '#000' }, team: { bg: '#EEF5FF', color: '#1A5C9C', border: '#99C2F0' }, client: { bg: '#E5E2D8', color: '#888880', border: '#CCC9B5' } }

  async function createShareLink() {
    const label = prompt('Label for this link (e.g. "MR DIY Client View"):')
    if (!label) return
    const { data: { session } } = await supabase.auth.getSession()
    const { data, error } = await supabase.from('share_tokens').insert({ label, created_by: session?.user.id }).select().single()
    if (error) { showToast('Error creating link', 'danger'); return }
    setShareLinks(prev => [data, ...prev])
    showToast('✅ Share link created!')
  }

  async function deleteShareLink(id: string) {
    if (!confirm('Delete this share link? Anyone using it will lose access.')) return
    await supabase.from('share_tokens').delete().eq('id', id)
    setShareLinks(prev => prev.filter(l => l.id !== id))
    showToast('🗑️ Link deleted', 'info')
  }

  return (
    <div>
      {toast && (
        <div className="fixed top-20 right-4 z-50 px-4 py-3 rounded-xl font-bold text-sm shadow-xl"
          style={{ background: toast.type === 'danger' ? '#FFF1F1' : toast.type === 'info' ? '#EEF5FF' : '#F0FFF5', border: `1.5px solid ${toast.type === 'danger' ? '#FFBBBB' : toast.type === 'info' ? '#99C2F0' : '#99DDB8'}`, color: toast.type === 'danger' ? '#C92B2B' : toast.type === 'info' ? '#1A5C9C' : '#1A7A3C', minWidth: '240px' }}>
          {toast.msg}
        </div>
      )}

      <h1 className="text-2xl font-extrabold tracking-wide mb-5" style={{ fontFamily: '"Black Han Sans",sans-serif' }}>SETTINGS</h1>

      {/* Telegram */}
      <div className="rounded-xl overflow-hidden shadow-sm mb-5" style={{ border: '1.5px solid #E2DFD3' }}>
        <div className="flex items-center justify-between px-5 py-3" style={{ background: '#1A1A1A', borderBottom: '3px solid #FFD600' }}>
          <span className="font-extrabold text-white" style={{ fontFamily: '"Black Han Sans",sans-serif', fontSize: '15px' }}>📨 Telegram Notifications</span>
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: tgActive ? '#34C759' : 'rgba(255,255,255,.4)' }}>{tgActive ? '● Active' : 'Not Configured'}</span>
        </div>
        <div className="bg-white p-5">
          <div className="flex items-center gap-3 p-3 rounded-lg mb-4 text-sm font-bold" style={{ background: '#F7F6F2', border: '1.5px solid #E2DFD3', color: '#3A3A38' }}>
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: tgActive ? '#34C759' : '#888880', boxShadow: tgActive ? '0 0 6px rgba(52,199,89,.5)' : 'none' }}></span>
            {tgActive ? 'Bot is active. Reminders sent 1 day before each service date.' : 'Configure your Telegram bot to enable automatic notifications.'}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><FL>Bot Token</FL><Fi value={tgToken} onChange={setTgToken} placeholder="1234567890:ABCdef…" /></div>
            <div><FL>Group Chat ID</FL><Fi value={tgChatId} onChange={setTgChatId} placeholder="-100123456789" /></div>
          </div>
          <div className="p-3 rounded-lg mb-4 text-xs leading-relaxed" style={{ background: '#F7F6F2', border: '1px solid #E2DFD3', color: '#888880' }}>
            <strong style={{ color: '#3A3A38' }}>Setup:</strong> 1) Message <strong>@BotFather</strong> on Telegram → /newbot → copy the token &nbsp;
            2) Add the bot to your internal group &nbsp;
            3) Get Chat ID from <strong>@userinfobot</strong> in the group
          </div>
          <div className="flex gap-3">
            <Btn dark sm onClick={saveTg}>Save &amp; Test</Btn>
            <Btn outline sm onClick={clearTg}>Clear</Btn>
          </div>
        </div>
      </div>

      {/* Users + Role info */}
      <div className="grid grid-cols-2 gap-5">
        <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: '1.5px solid #E2DFD3' }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ background: '#1A1A1A', borderBottom: '3px solid #FFD600' }}>
            <span className="font-extrabold text-white" style={{ fontFamily: '"Black Han Sans",sans-serif', fontSize: '14px' }}>👥 Users</span>
            <Btn sm onClick={openAddUser}>+ Add</Btn>
          </div>
          <div className="bg-white p-2">
            {users.map(u => {
              const rs = roleStyle[u.role] || roleStyle.client
              const isSelf = u.id === currentUser?.id
              return (
                <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg mb-1.5 hover:bg-gray-50 transition-colors"
                  style={{ border: '1.5px solid #E2DFD3', background: '#F7F6F2' }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center font-extrabold text-sm flex-shrink-0" style={{ background: '#FFD600', color: '#000' }}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-sm">{u.name}{isSelf && <span className="text-xs font-normal ml-1" style={{ color: '#888880' }}>(you)</span>}</div>
                    <div className="font-mono text-xs mt-0.5" style={{ color: '#888880' }}>@{u.username}</div>
                  </div>
                  <span className="text-xs font-extrabold uppercase tracking-wide px-2 py-1 rounded" style={{ background: rs.bg, color: rs.color, border: 'border' in rs ? `1px solid ${rs.border}` : 'none' }}>{u.role}</span>
                  <button onClick={() => openEditUser(u)} className="action-btn">✏️</button>
                  {!isSelf && u.role !== 'master' && <button onClick={() => deleteUser(u.id)} className="action-btn">🗑️</button>}
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: '1.5px solid #E2DFD3' }}>
          <div className="px-4 py-3" style={{ background: '#1A1A1A', borderBottom: '3px solid #FFD600' }}>
            <span className="font-extrabold text-white" style={{ fontFamily: '"Black Han Sans",sans-serif', fontSize: '14px' }}>ℹ️ Role Permissions</span>
          </div>
          <div className="bg-white p-5 text-sm leading-loose" style={{ color: '#3A3A38' }}>
            <div className="mb-3"><span className="text-xs font-extrabold uppercase px-2 py-1 rounded mr-2" style={{ background: '#FFD600', color: '#000' }}>Master</span>Full access — jobs, users, settings, Telegram</div>
            <div className="mb-3"><span className="text-xs font-extrabold uppercase px-2 py-1 rounded mr-2" style={{ background: '#EEF5FF', color: '#1A5C9C', border: '1px solid #99C2F0' }}>Team</span>View + edit jobs, mark done, see reminders &amp; overview</div>
            <div><span className="text-xs font-extrabold uppercase px-2 py-1 rounded mr-2" style={{ background: '#E5E2D8', color: '#888880', border: '1px solid #CCC9B5' }}>Client</span>View Job Board only — no alerts or editing</div>
          </div>
        </div>
      </div>

      {/* User Modal */}
      {/* ── SHARE LINKS ────────────────────────────── */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-extrabold" style={{fontFamily:'"Black Han Sans",sans-serif'}}>🔗 CLIENT SHARE LINKS</h2>
            <p className="text-xs mt-1" style={{color:'#888880'}}>Generate passwordless links for clients to view the job board without logging in.</p>
          </div>
          <Btn sm onClick={createShareLink}>+ New Link</Btn>
        </div>
        <div className="rounded-xl overflow-hidden shadow-sm" style={{border:'1.5px solid #E2DFD3',background:'#fff'}}>
          {shareLinks.length === 0 ? (
            <div className="text-center py-10" style={{color:'#888880'}}>
              <div className="text-3xl mb-2">🔗</div>
              <div className="text-sm font-bold tracking-widest uppercase">No share links yet</div>
              <div className="text-xs mt-1">Click "+ New Link" to generate one</div>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead style={{background:'#1A1A1A',borderBottom:'3px solid #FFD600'}}>
                <tr>
                  {['Label','Share URL','Created',''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-extrabold tracking-widest uppercase" style={{color:'rgba(255,255,255,.7)'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shareLinks.map(link => {
                  const url = typeof window !== 'undefined' ? `${window.location.origin}/share/${link.token}` : `/share/${link.token}`
                  return (
                    <tr key={link.id} className="border-b" style={{borderColor:'#E2DFD3'}}>
                      <td className="px-4 py-3 font-extrabold text-sm">{link.label}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs truncate max-w-[300px]" style={{color:'#888880'}}>{url}</span>
                          <button onClick={() => { navigator.clipboard.writeText(url); showToast('✅ Link copied!') }}
                            className="action-btn flex-shrink-0">Copy</button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono" style={{color:'#888880'}}>
                        {new Date(link.created_at).toLocaleDateString('en-MY')}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => deleteShareLink(link.id)} className="action-btn">🗑️ Delete</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,15,15,.55)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-96 max-w-full p-6" style={{ border: '1.5px solid #E2DFD3', animation: 'slideUp .2s ease' }}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-extrabold" style={{ fontFamily: '"Black Han Sans",sans-serif' }}>{editUser ? '✏️ EDIT USER' : '+ ADD USER'}</h2>
              <button onClick={() => setShowUserModal(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400" style={{ background: '#F7F6F2', border: '1px solid #E2DFD3' }}>✕</button>
            </div>
            <div className="space-y-3">
              <div><FL>Full Name</FL><Fi value={uName} onChange={setUName} placeholder="Ahmad Farizal" /></div>
              <div><FL>Username</FL><Fi value={uUsername} onChange={setUUsername} placeholder="ahmad.farizal" /></div>
              <div><FL>Password</FL><Fi value={uPassword} onChange={setUPassword} placeholder={editUser ? 'Leave blank to keep current…' : 'Set a password'} type="password" /></div>
              {(!editUser || editUser.role !== 'master') && (
                <div>
                  <FL>Role</FL>
                  <select value={uRole} onChange={e => setURole(e.target.value as any)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: '#F7F6F2', border: '1.5px solid #E2DFD3', fontFamily: '"Barlow Condensed",sans-serif', fontSize: '14px' }}>
                    <option value="team">Team (View + Edit)</option>
                    <option value="client">Client (View Only)</option>
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-5 pt-4 border-t" style={{ borderColor: '#E2DFD3' }}>
              <Btn outline onClick={() => setShowUserModal(false)}>Cancel</Btn>
              <Btn dark onClick={saveUser}>Save</Btn>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes slideUp { from { transform: translateY(14px); opacity: 0; } to { transform: none; opacity: 1; } }
        .action-btn { background: #F7F6F2; border: 1.5px solid #E2DFD3; border-radius: 6px; color: #888880; padding: 4px 9px; font-size: 11px; cursor: pointer; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; transition: all .15s; }
        .action-btn:hover { border-color: #D4AF00; color: #1A1A1A; background: #fff; }
      `}</style>
    </div>
  )
}