'use client'
// app/share/[token]/page.tsx — Public read-only job board via share token (no login required)
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Job, SVC_META, ServiceKey, TL_STAGES, TL_FINAL } from '@/types'
import { daysFromNow, formatDate, svcStatus, countdownLabel } from '@/lib/utils'

function TimelinePanel({ job }: { job: Job }) {
  const svcs = Object.keys(job.services) as ServiceKey[]
  return (
    <div style={{ borderTop: '1.5px dashed #CCC9B5', marginTop: '10px', paddingTop: '12px' }}>
      <p className="text-xs font-extrabold tracking-widest uppercase mb-3" style={{ color: '#888880' }}>📊 Progress Timeline</p>
      <div className="flex flex-col gap-3">
        {svcs.map(k => {
          const stages = TL_STAGES[k]
          const cur = job.tl_stages?.[k] ?? 0
          return (
            <div key={k} className="rounded-xl p-3" style={{ background: '#F7F6F2', border: '1.5px solid #E2DFD3' }}>
              <div className="text-xs font-extrabold uppercase tracking-wide mb-3" style={{ color: '#3A3A38', fontSize: '12px' }}>
                {SVC_META[k].icon} {SVC_META[k].label}
              </div>
              <div className="flex items-start">
                {stages.map((stage, i) => {
                  const isPast = i < cur, isActive = i === cur
                  const dotBg = isPast || (isActive && i === TL_FINAL) ? '#1A7A3C' : isActive ? '#FFD600' : '#fff'
                  const dotBorder = isPast || (isActive && i === TL_FINAL) ? '#1A7A3C' : isActive ? '#D4AF00' : '#CCC9B5'
                  const dotColor = isPast || (isActive && i === TL_FINAL) ? '#fff' : isActive ? '#1A1A1A' : '#888880'
                  const lblColor = isPast ? '#1A7A3C' : isActive ? '#D4AF00' : '#888880'
                  const dotContent = isPast ? '✓' : (isActive && i === TL_FINAL) ? '✓' : stage.icon
                  return (
                    <div key={i} className="flex items-start flex-1">
                      <div className="flex flex-col items-center flex-shrink-0" style={{ minWidth: '56px' }}>
                        <div className="flex items-center justify-center rounded-full font-extrabold"
                          style={{ width: '30px', height: '30px', fontSize: '14px', background: dotBg, border: `2.5px solid ${dotBorder}`, color: dotColor }}>
                          {dotContent}
                        </div>
                        <div className="text-center mt-1.5 leading-tight" style={{ fontSize: '11px', color: lblColor, fontWeight: isPast || isActive ? '800' : '600', maxWidth: '80px' }}>
                          {stage.lbl}
                        </div>
                      </div>
                      {i < stages.length - 1 && (
                        <div className="flex-1 mt-4" style={{ height: '3px', background: i < cur ? '#D4AF00' : '#E2DFD3' }} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function SharePage({ params }: { params: { token: string } }) {
  const supabase = createClient()
  const [jobs, setJobs] = useState<Job[]>([])
  const [label, setLabel] = useState('Campaign Job Tracker')
  const [loading, setLoading] = useState(true)
  const [invalid, setInvalid] = useState(false)
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('')

  useEffect(() => {
    async function load() {
      // Validate token
      const { data: tokenRow } = await supabase
        .from('share_tokens')
        .select('*')
        .eq('token', params.token)
        .single()

      if (!tokenRow) { setInvalid(true); setLoading(false); return }

      // Check expiry
      if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
        setInvalid(true); setLoading(false); return
      }

      setLabel(tokenRow.label || 'Campaign Job Tracker')

      const { data: j } = await supabase.from('jobs').select('*').order('created_at', { ascending: false })
      setJobs(j || [])
      setLoading(false)
    }
    load()
  }, [params.token])

  const filtered = jobs.filter(j => {
    const q = search.toLowerCase()
    const mq = !q || j.name.toLowerCase().includes(q) || j.code.toLowerCase().includes(q)
    const ms = !stateFilter || j.state === stateFilter
    return mq && ms
  })

  const states = [...new Set(jobs.map(j => j.state).filter(Boolean))].sort()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#1A1A1A' }}>
      <div className="text-center">
        <p className="text-white text-sm font-bold tracking-widest uppercase opacity-60">Loading…</p>
      </div>
    </div>
  )

  if (invalid) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#1A1A1A' }}>
      <div className="text-center bg-white rounded-2xl p-10 shadow-2xl" style={{ maxWidth: '400px' }}>
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-xl font-extrabold mb-2" style={{ fontFamily: '"Black Han Sans",sans-serif' }}>INVALID LINK</h2>
        <p className="text-sm" style={{ color: '#888880' }}>This share link is invalid or has expired. Please request a new one.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F7F6F2' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6"
        style={{ background: '#1A1A1A', height: '60px', boxShadow: '0 2px 10px rgba(0,0,0,.2)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#FFD600' }}>
            <span style={{ fontSize: '16px' }}>🔧</span>
          </div>
          <div>
            <div className="font-extrabold text-white text-lg leading-none" style={{ fontFamily: '"Black Han Sans",sans-serif', letterSpacing: '1px' }}>MR.DIY</div>
            <div className="text-xs font-bold tracking-widest uppercase leading-none" style={{ color: 'rgba(255,255,255,.35)' }}>Campaign Tracker</div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.15)' }}>
          <span style={{ fontSize: '12px' }}>👁️</span>
          <span className="text-xs font-bold tracking-wide" style={{ color: 'rgba(255,255,255,.7)' }}>VIEW ONLY</span>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-3 md:p-6">
        <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-extrabold tracking-wide" style={{ fontFamily: '"Black Han Sans",sans-serif' }}>JOB BOARD</h1>
            <p className="text-sm mt-0.5" style={{ color: '#888880' }}>{label}</p>
          </div>
          <div className="flex gap-2 flex-wrap w-full md:w-auto">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search store / code…"
              className="px-4 py-2 rounded-lg text-sm outline-none flex-1 md:w-48 md:flex-none"
              style={{ background: '#fff', border: '1.5px solid #E2DFD3', fontFamily: '"Barlow Condensed",sans-serif' }} />
            <select value={stateFilter} onChange={e => setStateFilter(e.target.value)} className="px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: '#fff', border: '1.5px solid #E2DFD3', fontFamily: '"Barlow Condensed",sans-serif' }}>
              <option value="">All States</option>
              {states.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Mobile card view */}
        <div className="block md:hidden flex flex-col gap-3 mb-4">
          {filtered.map(j => (
            <div key={j.id} className="rounded-xl p-4 shadow-sm" style={{ border: '1.5px solid #E2DFD3', background: '#fff' }}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-extrabold text-sm">{j.name}</div>
                  <div className="font-mono text-xs mt-0.5" style={{ color: '#D4AF00' }}>{j.code}</div>
                </div>
                <span className="px-2 py-1 rounded text-xs font-bold ml-2 flex-shrink-0" style={{ background: '#E5E2D8', border: '1px solid #CCC9B5', color: '#3A3A38' }}>{j.state || '—'}</span>
              </div>
              <div className="text-xs mb-2" style={{ color: '#888880' }}>{j.addr}</div>
              <div className="flex items-center gap-2 mb-3 text-xs font-bold">{j.pic} <span className="font-mono font-normal" style={{ color: '#888880' }}>{j.phone}</span></div>
              <div className="flex flex-col gap-1.5">
                {(Object.entries(j.services) as [ServiceKey, any][]).map(([k, s]) => {
                  const st = svcStatus(s)
                  const d = daysFromNow(s.date)
                  const { label: cdLbl } = countdownLabel(d, s.done)
                  const chipBg = st === 'done' ? '#F0FFF5' : st === 'overdue' ? '#FFF1F1' : st === 'soon' ? '#FFF6ED' : '#F7F6F2'
                  const chipBorder = st === 'done' ? '#99DDB8' : st === 'overdue' ? '#FFBBBB' : st === 'soon' ? '#FFD099' : '#E2DFD3'
                  return (
                    <div key={k} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                      style={{ background: chipBg, border: `1.5px solid ${chipBorder}` }}>
                      <span className="text-base w-5 text-center flex-shrink-0">{SVC_META[k].icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-extrabold uppercase tracking-wide" style={{ color: '#3A3A38' }}>{SVC_META[k].label}</div>
                        <div className={`font-mono text-xs mt-0.5 font-semibold ${st === 'overdue' ? 'text-red-600' : st === 'soon' ? 'text-orange-600' : st === 'done' ? 'text-green-700' : 'text-gray-400'}`}>{formatDate(s.date)}</div>
                      </div>
                      <span className="text-xs font-extrabold">{cdLbl}</span>
                    </div>
                  )
                })}
              </div>
              {j.timeline && <TimelinePanel job={j} />}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-3">🗂️</div>
              <div className="text-sm font-bold tracking-widest uppercase">No jobs found</div>
            </div>
          )}
        </div>

        {/* Desktop table view */}
        <div className="hidden md:block rounded-xl overflow-hidden shadow-sm" style={{ border: '1.5px solid #E2DFD3', background: '#fff' }}>
          <table className="w-full border-collapse">
            <thead style={{ background: '#1A1A1A', borderBottom: '3px solid #FFD600' }}>
              <tr>
                {['Store', 'State', 'Store PIC', 'Services & Key Dates'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-extrabold tracking-widest uppercase whitespace-nowrap" style={{ color: 'rgba(255,255,255,.7)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(j => (
                <tr key={j.id} className="border-b" style={{ borderColor: '#E2DFD3' }}>
                  <td className="px-4 py-3">
                    <div className="font-extrabold text-sm">{j.name}</div>
                    <div className="font-mono text-xs mt-0.5" style={{ color: '#D4AF00' }}>{j.code}</div>
                    <div className="text-xs mt-1 leading-snug max-w-[200px]" style={{ color: '#888880' }}>{j.addr}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded text-xs font-bold" style={{ background: '#E5E2D8', border: '1px solid #CCC9B5', color: '#3A3A38' }}>{j.state || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-extrabold text-sm">{j.pic || '—'}</div>
                    <div className="font-mono text-xs mt-1" style={{ color: '#888880' }}>{j.phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5 min-w-[260px]">
                      {(Object.entries(j.services) as [ServiceKey, any][]).map(([k, s]) => {
                        const st = svcStatus(s)
                        const d = daysFromNow(s.date)
                        const { label: cdLbl, cls: cdCls } = countdownLabel(d, s.done)
                        const chipBg = st === 'done' ? '#F0FFF5' : st === 'overdue' ? '#FFF1F1' : st === 'soon' ? '#FFF6ED' : '#F7F6F2'
                        const chipBorder = st === 'done' ? '#99DDB8' : st === 'overdue' ? '#FFBBBB' : st === 'soon' ? '#FFD099' : '#E2DFD3'
                        const cdMap: Record<string, string> = { done: 'cd-done', overdue: 'cd-overdue', today: 'cd-today', soon: 'cd-soon', ok: 'cd-ok' }
                        return (
                          <div key={k} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                            style={{ background: chipBg, border: `1.5px solid ${chipBorder}` }}>
                            <span className="text-base w-5 text-center flex-shrink-0">{SVC_META[k].icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-extrabold uppercase tracking-wide" style={{ color: '#3A3A38' }}>{SVC_META[k].label}</div>
                              <div className={`font-mono text-xs mt-0.5 font-semibold ${st === 'overdue' ? 'text-red-600' : st === 'soon' ? 'text-orange-600' : st === 'done' ? 'text-green-700' : 'text-gray-400'}`}>
                                {formatDate(s.date)}
                              </div>
                            </div>
                            <span className={`text-xs font-extrabold uppercase tracking-wide px-2 py-0.5 rounded ${cdMap[cdCls] || 'cd-ok'}`}>{cdLbl}</span>
                          </div>
                        )
                      })}
                      {j.timeline && <TimelinePanel job={j} />}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="text-center py-12 text-gray-400">
                  <div className="text-4xl mb-3">🗂️</div>
                  <div className="text-sm font-bold tracking-widest uppercase">No jobs found</div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 px-6" style={{ borderTop: '1px solid #E2DFD3', background: '#fff' }}>
        <p style={{ fontSize: '10px', fontFamily: '"Barlow Condensed",sans-serif', fontWeight: 600, letterSpacing: '.5px', color: '#888880' }}>
          This system is the proprietary technology of C&amp;C Creative Consultancy Sdn Bhd. Unauthorized use or reproduction is prohibited.
        </p>
      </footer>

      <style>{`
        .cd-done    { background:#F0FFF5; color:#1A7A3C; border:1px solid #99DDB8; border-radius:4px; }
        .cd-overdue { background:#FFF1F1; color:#C92B2B; border:1px solid #FFBBBB; border-radius:4px; }
        .cd-today   { background:#FFD600; color:#1A1A1A; border:1px solid #D4AF00; border-radius:4px; }
        .cd-soon    { background:#FFF6ED; color:#C06000; border:1px solid #FFD099; border-radius:4px; }
        .cd-ok      { background:#E5E2D8; color:#888880; border:1px solid #CCC9B5; border-radius:4px; }
      `}</style>
    </div>
  )
}
