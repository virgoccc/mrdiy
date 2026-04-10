'use client'
// app/dashboard/page.tsx — Job Board (full with timeline)
import Btn from '@/components/Btn'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Job, AppUser, SVC_META, ServiceKey, TL_STAGES, MALAYSIAN_STATES } from '@/types'
import { daysFromNow, formatDate, svcStatus, jobOverdue, jobAllDone, jobPending, countdownLabel, buildTelegramJobMsg } from '@/lib/utils'
import * as XLSX from 'xlsx'

function SL({ children }: any) {
  return <div className="text-xs font-extrabold tracking-widest uppercase mb-3 pb-2 mt-4" style={{ color: '#888880', borderBottom: '1.5px solid #E2DFD3' }}>{children}</div>
}
function FL({ children }: any) {
  return <label className="block text-xs font-extrabold tracking-widest uppercase mb-1" style={{ color: '#888880' }}>{children}</label>
}
function Fi({ value, onChange, placeholder, type = 'text' }: any) {
  return <input type={type} value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder}
    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
    style={{ background: '#F7F6F2', border: '1.5px solid #E2DFD3', fontFamily: '"Barlow Condensed",sans-serif', fontSize: '14px' }} />
}

function TimelinePanel({ job, canEdit, onStageClick }: { job: Job; canEdit: boolean; onStageClick: (svc: ServiceKey, stage: number) => void }) {
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
                  const doneCnt = Math.floor(cur / 2), hasActive = cur % 2 === 1
                  const isPast = i < doneCnt, isActive = hasActive && i === doneCnt
                  const dotBg = isPast ? '#1A7A3C' : isActive ? '#FFD600' : '#fff'
                  const dotBorder = isPast ? '#1A7A3C' : isActive ? '#D4AF00' : '#CCC9B5'
                  const dotColor = isPast ? '#fff' : isActive ? '#1A1A1A' : '#888880'
                  const dotShadow = isActive ? '0 0 0 3px rgba(255,214,0,.2)' : isPast ? '0 0 0 3px rgba(26,122,60,.15)' : 'none'
                  const lblColor = isPast ? '#1A7A3C' : isActive ? '#D4AF00' : '#888880'
                  const lblWeight = isActive || isPast ? '800' : '600'
                  const dotContent = isPast ? '✓' : stage.icon
                  const nextCur = i < doneCnt ? i * 2 + 1 : isActive ? (doneCnt + 1) * 2 : i * 2 + 1
                  return (
                    <div key={i} className="flex items-start flex-1">
                      <div className="flex flex-col items-center flex-shrink-0"
                        onClick={() => canEdit && onStageClick(k, nextCur)}
                        style={{ cursor: canEdit ? 'pointer' : 'default', minWidth: '56px' }}>
                        <div className="flex items-center justify-center rounded-full font-extrabold transition-all"
                          style={{ width: '30px', height: '30px', fontSize: '14px', background: dotBg, border: `2.5px solid ${dotBorder}`, color: dotColor, boxShadow: dotShadow, transition: 'all .2s' }}>
                          {dotContent}
                        </div>
                        <div className="text-center mt-1.5 leading-tight" style={{ fontSize: '11px', color: lblColor, fontWeight: lblWeight, maxWidth: '80px' }}>
                          {stage.lbl}
                        </div>
                      </div>
                      {i < stages.length - 1 && (
                        <div className="flex-1 mt-4" style={{ height: '3px', background: i < doneCnt ? '#D4AF00' : '#E2DFD3', transition: 'background .25s' }} />
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

export default function JobBoardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [user, setUser] = useState<AppUser | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'overdue' | 'pending' | 'done'>('all')
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editJob, setEditJob] = useState<Job | null>(null)
  const [toastMsg, setToastMsg] = useState<{ msg: string; type: string } | null>(null)

  const [fName, setFName] = useState('')
  const [fCode, setFCode] = useState('')
  const [fState, setFState] = useState('')
  const [fAddr, setFAddr] = useState('')
  const [fPIC, setFPIC] = useState('')
  const [fPhone, setFPhone] = useState('')
  const [selSvcs, setSelSvcs] = useState<Set<ServiceKey>>(new Set())
  const [svcDates, setSvcDates] = useState<Record<string, string>>({})
  const [dismantleDates, setDismantleDates] = useState<Record<string, string>>({})
  const [tlEnabled, setTlEnabled] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/auth'); return }
    const { data: u } = await supabase.from('app_users').select('*').eq('id', session.user.id).single()
    setUser(u)
    const { data: j } = await supabase.from('jobs').select('*').order('created_at', { ascending: false })
    setJobs(j || [])
    setLoading(false)
  }

  function showToast(msg: string, type = 'success') {
    setToastMsg({ msg, type }); setTimeout(() => setToastMsg(null), 3500)
  }

  const canEdit = user?.role === 'master' || user?.role === 'team'
  const isMaster = user?.role === 'master'
  const isClient = user?.role === 'client'

  const filtered = jobs.filter(j => {
    const q = search.toLowerCase()
    const mq = !q || j.name.toLowerCase().includes(q) || j.code.toLowerCase().includes(q) || j.pic.toLowerCase().includes(q)
    const ms = !stateFilter || j.state === stateFilter
    let mf = true
    if (!isClient) {
      if (filter === 'overdue') mf = jobOverdue(j)
      else if (filter === 'done') mf = jobAllDone(j)
      else if (filter === 'pending') mf = jobPending(j)
    }
    return mq && ms && mf
  })

  const states = [...new Set(jobs.map(j => j.state).filter(Boolean))].sort()

  function openAddModal() {
    setEditJob(null); setFName(''); setFCode(''); setFState(''); setFAddr(''); setFPIC(''); setFPhone('')
    setSelSvcs(new Set()); setSvcDates({}); setDismantleDates({}); setTlEnabled(false); setShowModal(true)
  }

  function openEditModal(j: Job) {
    setEditJob(j); setFName(j.name); setFCode(j.code); setFState(j.state); setFAddr(j.addr); setFPIC(j.pic); setFPhone(j.phone)
    setSelSvcs(new Set(Object.keys(j.services) as ServiceKey[]))
    const sd: Record<string, string> = {}
    const dd: Record<string, string> = {}
    Object.entries(j.services).forEach(([k, s]) => { if (s) { sd[k] = s.date; if (s.date2) dd[k] = s.date2 } })
    setSvcDates(sd); setDismantleDates(dd); setTlEnabled(!!j.timeline); setShowModal(true)
  }

  function toggleSvc(k: ServiceKey) {
    setSelSvcs(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })
  }

  async function getTgConfig() {
    const { data } = await supabase.from('telegram_config').select('*').eq('id', 1).single()
    return data
  }

  async function sendTelegram(msg: string) {
    const cfg = await getTgConfig()
    if (!cfg?.token || !cfg?.chat_id) return
    try {
      await fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: cfg.chat_id, text: msg, parse_mode: 'Markdown' })
      })
    } catch {}
  }

  async function handleSave() {
    if (!fName.trim() || !fCode.trim()) { showToast('Store Name and Code required', 'danger'); return }
    if (!selSvcs.size) { showToast('Select at least one service', 'danger'); return }
    const services: Job['services'] = {}
    let missing = false
    selSvcs.forEach(k => {
      if (!svcDates[k]) { missing = true; return }
      const existing = editJob?.services[k]
      services[k] = { date: svcDates[k], ...(k === 'bunting' && dismantleDates[k] ? { date2: dismantleDates[k] } : {}), done: existing?.done || false }
    })
    if (missing) { showToast('Set a date for every service', 'danger'); return }

    const existingTl = editJob?.tl_stages || {}
    const tl_stages: Record<string, number> = {}
    Object.keys(services).forEach(k => { tl_stages[k] = existingTl[k as ServiceKey] ?? 1 })

    const payload = {
      name: fName.trim(), code: fCode.trim(), state: fState,
      addr: fAddr.trim(), pic: fPIC.trim(), phone: fPhone.trim(),
      services, timeline: tlEnabled, tl_stages,
    }

    if (editJob) {
      const { data, error } = await supabase.from('jobs').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editJob.id).select().single()
      if (error) { showToast('Error updating job', 'danger'); return }
      setJobs(prev => prev.map(j => j.id === editJob.id ? data : j))
      sendTelegram(buildTelegramJobMsg(data, false, SVC_META))
      showToast('✅ Job updated!')
    } else {
      const { data: { session } } = await supabase.auth.getSession()
      const { data, error } = await supabase.from('jobs').insert({ ...payload, created_by: session?.user.id }).select().single()
      if (error) { showToast('Error creating job', 'danger'); return }
      setJobs(prev => [data, ...prev])
      sendTelegram(buildTelegramJobMsg(data, true, SVC_META))
      showToast('✅ New job added!')
    }
    setShowModal(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this job?')) return
    await supabase.from('jobs').delete().eq('id', id)
    setJobs(prev => prev.filter(j => j.id !== id))
    showToast('🗑️ Job removed', 'info')
  }

  async function handleToggleDone(jobId: string, svc: ServiceKey) {
    const j = jobs.find(x => x.id === jobId); if (!j) return
    const newDone = !j.services[svc]?.done
    const updatedServices = { ...j.services, [svc]: { ...j.services[svc]!, done: newDone } }
    const updatedTlStages = { ...(j.tl_stages || {}) }
    if (j.timeline) {
      const tlFinal = TL_STAGES[svc].length * 2
      if (newDone) updatedTlStages[svc] = tlFinal
      else if (updatedTlStages[svc] === tlFinal) updatedTlStages[svc] = tlFinal - 1
    }
    const { data } = await supabase.from('jobs').update({ services: updatedServices, tl_stages: updatedTlStages, updated_at: new Date().toISOString() }).eq('id', jobId).select().single()
    if (data) {
      setJobs(prev => prev.map(x => x.id === jobId ? data : x))
      showToast(newDone ? `✅ ${SVC_META[svc].label} marked done!` : '↩️ Marked not done.', newDone ? 'success' : 'info')
    }
  }

  async function handleTlStage(jobId: string, svc: ServiceKey, stage: number) {
    const j = jobs.find(x => x.id === jobId); if (!j) return
    const updatedTlStages = { ...(j.tl_stages || {}), [svc]: stage }
    const newDone = stage >= TL_STAGES[svc].length * 2
    const updatedServices = { ...j.services, [svc]: { ...j.services[svc]!, done: newDone } }
    const { data } = await supabase.from('jobs').update({ tl_stages: updatedTlStages, services: updatedServices, updated_at: new Date().toISOString() }).eq('id', jobId).select().single()
    if (data) {
      setJobs(prev => prev.map(x => x.id === jobId ? data : x))
      if (newDone !== j.services[svc]?.done)
        showToast(newDone ? `✅ ${SVC_META[svc].label} marked done!` : `↩️ ${SVC_META[svc].label} set back to in progress.`, 'success')
    }
  }

  function flattenJobs(jobList: Job[]) {
    const rows: any[] = []
    jobList.forEach(j => {
      const svcs = Object.entries(j.services)
      if (!svcs.length) {
        rows.push({ Store: j.name, Code: j.code, State: j.state, Address: j.addr, PIC: j.pic, Phone: j.phone, Service: '—', Date: '—', Status: '—', 'Timeline Stage': '—' })
      } else {
        svcs.forEach(([k, s]) => {
          const stage = j.tl_stages?.[k as ServiceKey] ?? 0
          const stagesArr = TL_STAGES[k as ServiceKey]
          const stageIdx = Math.floor(stage / 2)
          const stageLbl = stageIdx >= stagesArr.length ? stagesArr[stagesArr.length - 1].lbl : stagesArr[stageIdx]?.lbl || '—'
          rows.push({ Store: j.name, Code: j.code, State: j.state, Address: j.addr, PIC: j.pic, Phone: j.phone, Service: SVC_META[k as ServiceKey].label, Date: formatDate(s!.date), Status: s!.done ? 'Done' : 'Pending', 'Timeline Stage': j.timeline ? stageLbl : 'N/A' })
        })
      }
    })
    return rows
  }

  function exportExcel() {
    const rows = flattenJobs(filtered)
    if (!rows.length) { showToast('No data to export', 'info'); return }
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Jobs')
    XLSX.writeFile(wb, `MRDIY_JobBoard_${new Date().toISOString().split('T')[0]}.xlsx`)
    showToast('⬇ Excel downloaded!')
  }

  function exportPDF() {
    const rows = flattenJobs(filtered)
    const date = new Date().toLocaleDateString('en-MY', { day: '2-digit', month: 'long', year: 'numeric' })
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>MR DIY Job Board</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:sans-serif;padding:24px;font-size:12px;color:#1A1A1A}
    .hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:12px;border-bottom:3px solid #FFD600}
    table{width:100%;border-collapse:collapse}thead{background:#1A1A1A}
    th{color:#FFD600;padding:8px 10px;text-align:left;font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase}
    td{padding:7px 10px;border-bottom:1px solid #E2DFD3;font-size:11px}
    .done{color:#1A7A3C;font-weight:700}.pending{color:#888}
    .footer{margin-top:20px;font-size:9px;color:#888;text-align:center;border-top:1px solid #E2DFD3;padding-top:10px}
    </style></head><body>
    <div class="hdr"><div style="display:flex;align-items:center;gap:8px"><div style="background:#FFD600;border-radius:6px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:16px">🔧</div><div><div style="font-size:18px;font-weight:800">MR.DIY</div><div style="font-size:9px;color:#888;letter-spacing:2px;text-transform:uppercase">Campaign Job Tracker</div></div></div><span style="font-size:11px;color:#888">${date}</span></div>
    <table><thead><tr><th>Store</th><th>Code</th><th>State</th><th>PIC</th><th>Phone</th><th>Service</th><th>Date</th><th>Status</th><th>Timeline</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td><strong>${r.Store}</strong></td><td style="font-family:monospace">${r.Code}</td><td>${r.State}</td><td>${r.PIC}</td><td style="font-family:monospace">${r.Phone}</td><td>${r.Service}</td><td style="font-family:monospace">${r.Date}</td><td class="${r.Status==='Done'?'done':'pending'}">${r.Status}</td><td>${r['Timeline Stage']}</td></tr>`).join('')}</tbody></table>
    <div class="footer">MR DIY Campaign Job Tracker — Confidential — ${date}</div></body></html>`
    const w = window.open('', '_blank', 'width=1100,height=700')
    if (w) { w.document.write(html); w.document.close(); w.onload = () => { w.focus(); w.print() } }
    showToast('🖨️ Print dialog opened!')
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-sm font-bold tracking-widest uppercase" style={{ color: '#888880' }}>Loading…</div>

  const Tab = ({ f, label }: { f: typeof filter; label: string }) => (
    <button onClick={() => setFilter(f)} className="px-4 py-1.5 rounded-md text-xs font-extrabold tracking-widest uppercase transition-all"
      style={{ background: filter === f ? '#1A1A1A' : '#fff', color: filter === f ? '#fff' : '#888880', border: `1.5px solid ${filter === f ? '#1A1A1A' : '#E2DFD3'}`, fontFamily: '"Barlow Condensed",sans-serif' }}>
      {label}
    </button>
  )

  return (
    <div>
      {toastMsg && (
        <div className="fixed top-20 right-4 z-[200] px-4 py-3 rounded-xl font-bold text-sm shadow-xl"
          style={{ background: toastMsg.type === 'danger' ? '#FFF1F1' : toastMsg.type === 'info' ? '#EEF5FF' : '#F0FFF5', border: `1.5px solid ${toastMsg.type === 'danger' ? '#FFBBBB' : toastMsg.type === 'info' ? '#99C2F0' : '#99DDB8'}`, color: toastMsg.type === 'danger' ? '#C92B2B' : toastMsg.type === 'info' ? '#1A5C9C' : '#1A7A3C', minWidth: '240px' }}>
          {toastMsg.msg}
        </div>
      )}

      {!isClient && (() => {
        const ov = jobs.filter(jobOverdue).length
        const sn = jobs.filter(j => !jobAllDone(j) && Object.values(j.services).some(s => { const d = daysFromNow(s!.date); return s && !s.done && d !== null && d >= 0 && d <= 2 })).length
        return (ov || sn) ? (
          <div className="flex flex-wrap gap-2 mb-4">
            {ov > 0 && <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold" style={{ background: '#FFF1F1', border: '1.5px solid #FFBBBB', color: '#C92B2B' }}>⚠️ {ov} store{ov > 1 ? 's' : ''} with overdue services!</div>}
            {sn > 0 && <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold" style={{ background: '#FFF6ED', border: '1.5px solid #FFD099', color: '#C06000' }}>⏰ {sn} store{sn > 1 ? 's' : ''} with services due within 2 days</div>}
          </div>
        ) : null
      })()}

      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h1 className="text-2xl font-extrabold tracking-wide" style={{ fontFamily: '"Black Han Sans",sans-serif' }}>JOB BOARD</h1>
        <div className="flex gap-2 flex-wrap items-center">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Store / code / PIC…"
            className="px-4 py-2 rounded-lg text-sm outline-none w-48"
            style={{ background: '#fff', border: '1.5px solid #E2DFD3', fontFamily: '"Barlow Condensed",sans-serif' }} />
          <select value={stateFilter} onChange={e => setStateFilter(e.target.value)} className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: '#fff', border: '1.5px solid #E2DFD3', fontFamily: '"Barlow Condensed",sans-serif' }}>
            <option value="">All States</option>
            {states.map(s => <option key={s}>{s}</option>)}
          </select>
          <Btn outline sm onClick={exportExcel}>⬇ Excel</Btn>
          <Btn outline sm onClick={exportPDF}>⬇ PDF</Btn>
          {canEdit && <Btn sm onClick={openAddModal}>+ Add Job</Btn>}
        </div>
      </div>

      {!isClient && (
        <div className="flex gap-1.5 mb-4 flex-wrap">
          <Tab f="all" label="All" />
          <Tab f="overdue" label="🔴 Overdue" />
          <Tab f="pending" label="⏳ Pending" />
          <Tab f="done" label="✅ All Done" />
        </div>
      )}

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
                    style={{ background: chipBg, border: `1.5px solid ${chipBorder}`, cursor: canEdit ? 'pointer' : 'default' }}
                    onClick={() => canEdit && handleToggleDone(j.id, k)}>
                    <span className="text-base w-5 text-center flex-shrink-0">{SVC_META[k].icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-extrabold uppercase tracking-wide" style={{ color: '#3A3A38' }}>{SVC_META[k].label}</div>
                      <div className={`font-mono text-xs mt-0.5 font-semibold ${st === 'overdue' ? 'text-red-600' : st === 'soon' ? 'text-orange-600' : st === 'done' ? 'text-green-700' : 'text-gray-400'}`}>{formatDate(s.date)}</div>
                    </div>
                    <span className="text-xs font-extrabold">{cdLbl}</span>
                    {canEdit && <div className={`w-5 h-5 rounded flex items-center justify-center text-xs font-extrabold flex-shrink-0 ${s.done ? 'bg-green-600 text-white' : 'border border-gray-300'}`}>{s.done ? '✓' : ''}</div>}
                  </div>
                )
              })}
            </div>
            {j.timeline && <TimelinePanel job={j} canEdit={canEdit} onStageClick={(svc, stage) => handleTlStage(j.id, svc, stage)} />}
            {canEdit && (
              <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: '1px solid #E2DFD3' }}>
                <button onClick={() => openEditModal(j)} className="action-btn">✏️ Edit</button>
                {isMaster && <button onClick={() => handleDelete(j.id)} className="action-btn">🗑️ Delete</button>}
              </div>
            )}
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
              {['Store', 'State', 'Store PIC', 'Services & Key Dates', canEdit ? 'Actions' : ''].filter(Boolean).map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-extrabold tracking-widest uppercase whitespace-nowrap" style={{ color: 'rgba(255,255,255,.7)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(j => (
              <tr key={j.id} className="border-b transition-colors" style={{ borderColor: '#E2DFD3' }}>
                <td className="px-4 py-3 align-top">
                  <div className="font-extrabold text-sm">{j.name}</div>
                  <div className="font-mono text-xs mt-0.5" style={{ color: '#D4AF00' }}>{j.code}</div>
                  <div className="text-xs mt-1 leading-snug max-w-[200px]" style={{ color: '#888880' }}>{j.addr}</div>
                </td>
                <td className="px-4 py-3 align-top">
                  <span className="px-2 py-1 rounded text-xs font-bold" style={{ background: '#E5E2D8', border: '1px solid #CCC9B5', color: '#3A3A38' }}>{j.state || '—'}</span>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="font-extrabold text-sm">{j.pic || '—'}</div>
                  <div className="font-mono text-xs mt-1" style={{ color: '#888880' }}>{j.phone}</div>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="flex flex-col gap-1.5 min-w-[260px]">
                    {(Object.entries(j.services) as [ServiceKey, any][]).map(([k, s]) => {
                      const displayDate = k === 'bunting' && s.date2 ? s.date2 : s.date
                      const st = svcStatus({ ...s, date: displayDate })
                      const d = daysFromNow(displayDate)
                      const { label: cdLbl, cls: cdCls } = countdownLabel(d, s.done)
                      const chipBg = st === 'done' ? '#F0FFF5' : st === 'overdue' ? '#FFF1F1' : st === 'soon' ? '#FFF6ED' : '#F7F6F2'
                      const chipBorder = st === 'done' ? '#99DDB8' : st === 'overdue' ? '#FFBBBB' : st === 'soon' ? '#FFD099' : '#E2DFD3'
                      const cdMap: Record<string, string> = { done: 'cd-done', overdue: 'cd-overdue', today: 'cd-today', soon: 'cd-soon', ok: 'cd-ok' }
                      return (
                        <div key={k} className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all"
                          style={{ background: chipBg, border: `1.5px solid ${chipBorder}`, cursor: canEdit ? 'pointer' : 'default' }}
                          onClick={() => canEdit && handleToggleDone(j.id, k)}>
                          <span className="text-base w-5 text-center flex-shrink-0">{SVC_META[k].icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-extrabold uppercase tracking-wide" style={{ color: '#3A3A38' }}>{SVC_META[k].label}</div>
                            <div className={`font-mono text-xs mt-0.5 font-semibold ${st === 'overdue' ? 'text-red-600' : st === 'soon' ? 'text-orange-600' : st === 'done' ? 'text-green-700' : 'text-gray-400'}`}>
                              {formatDate(displayDate)}
                            </div>
                          </div>
                          <span className={`text-xs font-extrabold uppercase tracking-wide px-2 py-0.5 rounded ${cdMap[cdCls] || 'cd-ok'}`}>{cdLbl}</span>
                          {canEdit && <div className={`w-5 h-5 rounded flex items-center justify-center text-xs font-extrabold flex-shrink-0 ${s.done ? 'bg-green-600 text-white' : 'border border-gray-300'}`}>{s.done ? '✓' : ''}</div>}
                        </div>
                      )
                    })}
                    {j.timeline && (
                      <TimelinePanel job={j} canEdit={canEdit} onStageClick={(svc, stage) => handleTlStage(j.id, svc, stage)} />
                    )}
                  </div>
                </td>
                {canEdit && (
                  <td className="px-4 py-3 align-top">
                    <button onClick={() => openEditModal(j)} className="action-btn mr-1">✏️</button>
                    {isMaster && <button onClick={() => handleDelete(j.id)} className="action-btn">🗑️</button>}
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={canEdit ? 5 : 4} className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-3">🗂️</div>
                <div className="text-sm font-bold tracking-widest uppercase">No jobs found</div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,15,15,.55)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-[640px] max-w-full max-h-[90vh] overflow-y-auto p-6"
            style={{ border: '1.5px solid #E2DFD3', animation: 'slideUp .2s ease' }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-extrabold" style={{ fontFamily: '"Black Han Sans",sans-serif' }}>{editJob ? '✏️ EDIT JOB' : '+ NEW JOB'}</h2>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400" style={{ background: '#F7F6F2', border: '1px solid #E2DFD3' }}>✕</button>
            </div>

            <SL>Store Details</SL>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><FL>Full Store Name</FL><Fi value={fName} onChange={setFName} placeholder="MR DIY Sunway Pyramid" /></div>
              <div><FL>Store Code</FL><Fi value={fCode} onChange={setFCode} placeholder="MY-SP-042" /></div>
              <div><FL>State</FL>
                <select value={fState} onChange={e => setFState(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: '#F7F6F2', border: '1.5px solid #E2DFD3', fontFamily: '"Barlow Condensed",sans-serif', fontSize: '14px' }}>
                  <option value="">Select State</option>
                  {MALAYSIAN_STATES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2"><FL>Address</FL><textarea value={fAddr} onChange={e => setFAddr(e.target.value)} placeholder="Lot 12, Level 1…" rows={2} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y" style={{ background: '#F7F6F2', border: '1.5px solid #E2DFD3', fontFamily: '"Barlow Condensed",sans-serif', fontSize: '14px' }} /></div>
              <div><FL>Store PIC Name</FL><Fi value={fPIC} onChange={setFPIC} placeholder="Ahmad Farizal" /></div>
              <div><FL>PIC Phone</FL><Fi value={fPhone} onChange={setFPhone} placeholder="011-2345 6789" /></div>
            </div>

            <SL>Services Required</SL>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {(Object.keys(SVC_META) as ServiceKey[]).map(k => (
                <div key={k} onClick={() => toggleSvc(k)} className="rounded-xl p-3 text-center cursor-pointer transition-all"
                  style={{ border: `2px solid ${selSvcs.has(k) ? '#D4AF00' : '#E2DFD3'}`, background: selSvcs.has(k) ? '#FFFBEA' : '#F7F6F2', boxShadow: selSvcs.has(k) ? '0 0 0 3px rgba(255,214,0,.12)' : 'none' }}>
                  <div className="text-xl mb-1">{SVC_META[k].icon}</div>
                  <div className="text-xs font-extrabold uppercase tracking-wide" style={{ color: '#3A3A38' }}>{SVC_META[k].label}</div>
                </div>
              ))}
            </div>

            {selSvcs.size > 0 && (
              <div className="rounded-xl p-4 mb-2" style={{ background: '#F7F6F2', border: '1.5px solid #E2DFD3' }}>
                <p className="text-xs font-extrabold tracking-widest uppercase mb-3" style={{ color: '#888880' }}>Key Dates</p>
                <div className="grid grid-cols-2 gap-3">
                  {[...selSvcs].map(k => (
                    <div key={k}><FL>{SVC_META[k].icon} {SVC_META[k].hint}</FL>
                      <input type="date" value={svcDates[k] || ''} onChange={e => setSvcDates(p => ({ ...p, [k]: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: '#fff', border: '1.5px solid #E2DFD3', fontFamily: '"Barlow Condensed",sans-serif', fontSize: '14px' }} />
                    </div>
                  ))}
                  {selSvcs.has('bunting') && (
                    <div><FL>🚧 Dismantle Date</FL>
                      <input type="date" value={dismantleDates['bunting'] || ''} onChange={e => setDismantleDates(p => ({ ...p, bunting: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: '#fff', border: '1.5px solid #E2DFD3', fontFamily: '"Barlow Condensed",sans-serif', fontSize: '14px' }} />
                    </div>
                  )}
                </div>
              </div>
            )}

            <SL>Progress Timeline</SL>
            <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: '#F7F6F2', border: '1.5px solid #E2DFD3' }}>
              <div>
                <div className="text-sm font-extrabold" style={{ color: '#1A1A1A' }}>Enable Detailed Progress Timeline</div>
                <div className="text-xs mt-0.5" style={{ color: '#888880' }}>Shows step-by-step stage tracking per service below the job row</div>
              </div>
              <div onClick={() => setTlEnabled(!tlEnabled)}
                className="relative flex-shrink-0 ml-4 rounded-full cursor-pointer"
                style={{ width: '42px', height: '24px', background: tlEnabled ? '#D4AF00' : '#CCC9B5', transition: 'background .2s' }}>
                <div className="absolute top-[3px] rounded-full bg-white"
                  style={{ width: '18px', height: '18px', left: tlEnabled ? '21px' : '3px', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-5 pt-4 border-t" style={{ borderColor: '#E2DFD3' }}>
              <Btn outline onClick={() => setShowModal(false)}>Cancel</Btn>
              <Btn dark onClick={handleSave}>Save Job</Btn>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp { from { transform: translateY(14px); opacity: 0; } to { transform: none; opacity: 1; } }
        .action-btn { background: #F7F6F2; border: 1.5px solid #E2DFD3; border-radius: 6px; color: #888880; padding: 4px 10px; font-size: 12px; cursor: pointer; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; transition: all .15s; }
        .action-btn:hover { border-color: #D4AF00; color: #1A1A1A; background: #fff; }
        .cd-done    { background:#F0FFF5; color:#1A7A3C; border:1px solid #99DDB8; border-radius:4px; }
        .cd-overdue { background:#FFF1F1; color:#C92B2B; border:1px solid #FFBBBB; border-radius:4px; }
        .cd-today   { background:#FFD600; color:#1A1A1A; border:1px solid #D4AF00; border-radius:4px; }
        .cd-soon    { background:#FFF6ED; color:#C06000; border:1px solid #FFD099; border-radius:4px; }
        .cd-ok      { background:#E5E2D8; color:#888880; border:1px solid #CCC9B5; border-radius:4px; }
      `}</style>
    </div>
  )
}
