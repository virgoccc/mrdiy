'use client'
import Btn from '@/components/Btn'
// app/dashboard/reminders/page.tsx
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Job, SVC_META, ServiceKey } from '@/types'
import { daysFromNow, formatDate, buildTelegramReminderMsg } from '@/lib/utils'
import * as XLSX from 'xlsx'

export default function RemindersPage() {
  const supabase = createClient()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('jobs').select('*').then(({ data }) => {
      setJobs(data || [])
      setLoading(false)
    })
    // Fire reminder check on load
    checkAndSendReminders()
  }, [])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  async function checkAndSendReminders() {
    const { data: jobs } = await supabase.from('jobs').select('*')
    if (!jobs) return
    const { data: cfg } = await supabase.from('telegram_config').select('*').eq('id', 1).single()
    const today = new Date().toISOString().split('T')[0]

    for (const j of jobs) {
      for (const [k, s] of Object.entries(j.services) as [ServiceKey, any][]) {
        if (!s || s.done) continue
        if (daysFromNow(s.date) !== 1) continue
        // Check if already fired today
        const { data: existing } = await supabase.from('reminder_log')
          .select('id').eq('job_id', j.id).eq('service_key', k).eq('fired_date', today).single()
        if (existing) continue
        // Log it
        await supabase.from('reminder_log').insert({ job_id: j.id, service_key: k, fired_date: today })
        // Send Telegram
        if (cfg?.token && cfg?.chat_id) {
          try {
            await fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: cfg.chat_id, text: buildTelegramReminderMsg(j, k, SVC_META), parse_mode: 'Markdown' })
            })
          } catch {}
        }
      }
    }
  }

  const relevant = jobs.filter(j =>
    Object.values(j.services).some(s => {
      if (!s || s.done) return false
      const d = daysFromNow(s.date)
      return d !== null && d >= -1 && d <= 7
    })
  )

  function requestPush() {
    if (!('Notification' in window)) { showToast('⚠️ Notifications not supported'); return }
    Notification.requestPermission().then(p => showToast(p === 'granted' ? '🔔 Push alerts enabled!' : '❌ Permission denied'))
  }

  function exportExcel() {
    const rows: any[] = []
    relevant.forEach(j => (Object.entries(j.services) as [ServiceKey, any][]).forEach(([k, s]) => {
      if (!s || s.done) return
      const d = daysFromNow(s.date)
      if (d === null || d < -1 || d > 7) return
      rows.push({ Store: j.name, Code: j.code, State: j.state, Service: SVC_META[k].label, Date: formatDate(s.date), 'Days': d < 0 ? `${Math.abs(d)}d ago` : d === 0 ? 'TODAY' : `in ${d}d`, PIC: j.pic, Phone: j.phone })
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Reminders')
    XLSX.writeFile(wb, `MRDIY_Reminders_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400 font-bold tracking-widest uppercase text-sm">Loading…</div>

  return (
    <div>
      {toast && <div className="fixed top-20 right-4 z-50 px-4 py-3 rounded-xl font-bold text-sm shadow-xl" style={{background:'#F0FFF5',border:'1.5px solid #99DDB8',color:'#1A7A3C',minWidth:'240px'}}>{toast}</div>}

      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-extrabold tracking-wide" style={{fontFamily:'"Black Han Sans",sans-serif'}}>REMINDERS</h1>
        <div className="flex gap-2">
          <Btn outline sm onClick={requestPush}>🔔 Enable Push</Btn>
          <Btn outline sm onClick={exportExcel}>⬇ Excel</Btn>
        </div>
      </div>

      {/* Header panel */}
      <div className="rounded-xl overflow-hidden shadow-sm" style={{border:'1.5px solid #E2DFD3'}}>
        <div className="px-5 py-3 flex items-center justify-between" style={{background:'#1A1A1A',borderBottom:'3px solid #FFD600'}}>
          <span className="font-extrabold text-white text-base" style={{fontFamily:'"Black Han Sans",sans-serif'}}>📅 Services Due Within 7 Days</span>
          <span className="text-xs font-bold tracking-widest uppercase" style={{color:'rgba(255,255,255,.4)'}}>{relevant.length} store{relevant.length !== 1 ? 's' : ''}</span>
        </div>

        {relevant.length === 0 ? (
          <div className="bg-white text-center py-14 text-gray-400">
            <div className="text-4xl mb-3">✅</div>
            <div className="text-sm font-bold tracking-widest uppercase">No upcoming reminders</div>
          </div>
        ) : (
          <div className="grid gap-px bg-gray-200" style={{gridTemplateColumns:'repeat(auto-fill,minmax(290px,1fr))'}}>
            {relevant.map(j => {
              const pendSvcs = (Object.entries(j.services) as [ServiceKey, any][]).filter(([, s]) => s && !s.done)
              const near = pendSvcs.sort(([,a],[,b]) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]
              const nd = near ? new Date(near[1].date) : null; if (nd) nd.setHours(12)
              const dd = nd ? daysFromNow(near[1].date) : null
              const dayCol = dd !== null && dd < 0 ? '#C92B2B' : dd !== null && dd <= 1 ? '#C06000' : dd !== null && dd <= 3 ? '#D4AF00' : '#1A1A1A'

              return (
                <div key={j.id} className="bg-white p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="text-center rounded-xl px-3 py-2 flex-shrink-0" style={{background:'#F7F6F2',border:'1.5px solid #E2DFD3',minWidth:'52px'}}>
                      <div className="text-xs font-extrabold tracking-widest uppercase" style={{color:'#888880'}}>{nd ? nd.toLocaleDateString('en-MY',{month:'short'}).toUpperCase() : '—'}</div>
                      <div className="font-extrabold text-2xl leading-none" style={{fontFamily:'"Black Han Sans",sans-serif',color:dayCol}}>{nd ? nd.getDate() : '?'}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-extrabold text-sm leading-snug">{j.name}</div>
                      <div className="text-xs mt-1" style={{color:'#888880'}}>📌 {j.state} · <span className="font-mono">{j.code}</span></div>
                      <div className="text-xs mt-0.5" style={{color:'#888880'}}>👤 {j.pic} · {j.phone}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {pendSvcs.filter(([,s]) => { const d = daysFromNow(s.date); return d !== null && d >= -1 && d <= 7 }).map(([k, s]) => {
                      const d2 = daysFromNow(s.date)
                      const lbl = d2 === 0 ? 'TODAY' : d2 === 1 ? 'Tomorrow' : d2 !== null && d2 < 0 ? `${Math.abs(d2)}d ago` : `in ${d2}d`
                      const svcColors: Record<string, { bg: string; color: string; border: string }> = {
                        flyer: { bg: '#EEF5FF', color: '#1A5C9C', border: '#99C2F0' },
                        posm: { bg: '#FFFBEA', color: '#7A5800', border: '#D4B800' },
                        bunting: { bg: '#FFF6ED', color: '#C06000', border: '#FFD099' },
                      }
                      const sc = svcColors[k] || svcColors.flyer
                      return <span key={k} className="text-xs font-bold px-2 py-1 rounded uppercase tracking-wide" style={{background:sc.bg,color:sc.color,border:`1px solid ${sc.border}`}}>{SVC_META[k as ServiceKey].icon} {SVC_META[k as ServiceKey].label} · {lbl}</span>
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}