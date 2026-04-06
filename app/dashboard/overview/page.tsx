'use client'
import Btn from '@/components/Btn'
// app/dashboard/overview/page.tsx
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Job, SVC_META, ServiceKey } from '@/types'
import { daysFromNow, formatDate, jobOverdue, jobAllDone } from '@/lib/utils'
import * as XLSX from 'xlsx'

export default function OverviewPage() {
  const supabase = createClient()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('jobs').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setJobs(data || []); setLoading(false) })
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400 font-bold tracking-widest uppercase text-sm">Loading…</div>

  let totSvcs = 0, ovSvcs = 0, pendSvcs = 0, doneSvcs = 0
  jobs.forEach(j => Object.values(j.services).forEach(s => {
    if (!s) return; totSvcs++
    if (s.done) doneSvcs++
    else if ((daysFromNow(s.date) ?? 0) < 0) ovSvcs++
    else pendSvcs++
  }))

  const upcoming: { j: Job; k: ServiceKey; s: { date: string; done: boolean }; d: number }[] = []
  jobs.forEach(j => (Object.entries(j.services) as [ServiceKey, any][]).forEach(([k, s]) => {
    if (!s || s.done) return
    const d = daysFromNow(s.date)
    if (d !== null && d >= -2 && d <= 14) upcoming.push({ j, k, s, d })
  }))
  upcoming.sort((a, b) => a.d - b.d)

  const kpis = [
    { label: 'Total Stores', num: jobs.length, color: '#FFD600', border: '#FFD600' },
    { label: 'Total Services', num: totSvcs, color: '#1A5C9C', border: '#99C2F0' },
    { label: 'Overdue', num: ovSvcs, color: '#C92B2B', border: '#C92B2B' },
    { label: 'Pending', num: pendSvcs, color: '#C06000', border: '#C06000' },
    { label: 'Completed', num: doneSvcs, color: '#1A7A3C', border: '#1A7A3C' },
  ]

  function exportExcel() {
    const rows = upcoming.map(({ j, k, s, d }) => ({
      Store: j.name, Code: j.code, State: j.state, Service: SVC_META[k].label,
      Date: formatDate(s.date), 'Days Left': d < 0 ? `${Math.abs(d)} overdue` : d === 0 ? 'TODAY' : `${d}d`,
      PIC: j.pic, Phone: j.phone,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Overview')
    XLSX.writeFile(wb, `MRDIY_Overview_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  function exportPDF() {
    const date = new Date().toLocaleDateString('en-MY', { day: '2-digit', month: 'long', year: 'numeric' })
    const rows = upcoming.map(({ j, k, s, d }) => ({ ...j, svc: SVC_META[k].label, svcDate: formatDate(s.date), dLabel: d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'TODAY' : `${d}d left` }))
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>MR DIY Overview</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:sans-serif;padding:24px;font-size:12px}
    .hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:12px;border-bottom:3px solid #FFD600}
    .cards{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap}
    .card{background:#fff;border:1px solid #E2DFD3;border-radius:8px;padding:12px 16px;min-width:100px}
    .card-num{font-size:28px;font-weight:800;line-height:1}.card-lbl{font-size:10px;color:#888;margin-top:4px;text-transform:uppercase;letter-spacing:1px}
    h2{font-size:13px;font-weight:800;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px}
    table{width:100%;border-collapse:collapse}thead{background:#1A1A1A}
    th{color:#FFD600;padding:8px 10px;text-align:left;font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase}
    td{padding:7px 10px;border-bottom:1px solid #E2DFD3;font-size:11px}
    </style></head><body>
    <div class="hdr"><div style="display:flex;align-items:center;gap:8px"><div style="background:#FFD600;border-radius:6px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:16px">🔧</div><div><div style="font-size:18px;font-weight:800">MR.DIY</div><div style="font-size:9px;color:#888;letter-spacing:2px;text-transform:uppercase">Campaign Job Tracker</div></div></div><span style="font-size:11px;color:#888">${date}</span></div>
    <div class="cards">
      ${kpis.map(k => `<div class="card"><div class="card-num" style="color:${k.color}">${k.num}</div><div class="card-lbl">${k.label}</div></div>`).join('')}
    </div>
    <h2>Upcoming Deadlines (Next 14 Days)</h2>
    <table><thead><tr><th>Store</th><th>Code</th><th>State</th><th>Service</th><th>Date</th><th>Days</th><th>PIC</th><th>Phone</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td><strong>${r.name}</strong></td><td style="font-family:monospace">${r.code}</td><td>${r.state}</td><td>${r.svc}</td><td style="font-family:monospace">${r.svcDate}</td><td>${r.dLabel}</td><td>${r.pic}</td><td style="font-family:monospace">${r.phone}</td></tr>`).join('')}</tbody></table>
    </body></html>`
    const w = window.open('', '_blank', 'width=1000,height=700')
    if (w) { w.document.write(html); w.document.close(); w.onload = () => { w.focus(); w.print() } }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-extrabold tracking-wide" style={{fontFamily:'"Black Han Sans",sans-serif'}}>OVERVIEW</h1>
        <div className="flex gap-2">
          <Btn outline sm onClick={exportExcel}>⬇ Excel</Btn>
          <Btn outline sm onClick={exportPDF}>⬇ PDF</Btn>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-3 mb-6" style={{gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))'}}>
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-xl p-4 shadow-sm" style={{border:`1.5px solid #E2DFD3`,borderLeft:`4px solid ${k.border}`}}>
            <div className="font-extrabold text-4xl leading-none mb-1" style={{fontFamily:'"Black Han Sans",sans-serif',color:k.color}}>{k.num}</div>
            <div className="text-xs font-bold" style={{color:'#888880'}}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Upcoming deadlines */}
      <h2 className="font-extrabold tracking-wide mb-3" style={{fontFamily:'"Black Han Sans",sans-serif',fontSize:'16px'}}>UPCOMING DEADLINES</h2>
      <div className="rounded-xl overflow-hidden shadow-sm" style={{border:'1.5px solid #E2DFD3',background:'#fff'}}>
        <table className="w-full border-collapse">
          <thead style={{background:'#1A1A1A',borderBottom:'3px solid #FFD600'}}>
            <tr>{['Store','Code','State','Service','Key Date','Days','PIC','Phone'].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-extrabold tracking-widest uppercase whitespace-nowrap" style={{color:'rgba(255,255,255,.7)'}}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {upcoming.map(({ j, k, s, d }, i) => {
              const col = d < 0 ? '#C92B2B' : d === 0 ? '#C06000' : d <= 3 ? '#C06000' : '#888880'
              const lbl = d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'TODAY' : d <= 3 ? `${d}d left` : `${d}d left`
              return (
                <tr key={i} className="border-b hover:bg-gray-50 transition-colors" style={{borderColor:'#E2DFD3'}}>
                  <td className="px-4 py-3 font-extrabold text-sm">{j.name}</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{color:'#D4AF00'}}>{j.code}</td>
                  <td className="px-4 py-3"><span className="px-2 py-1 rounded text-xs font-bold" style={{background:'#E5E2D8',color:'#3A3A38'}}>{j.state}</span></td>
                  <td className="px-4 py-3 text-sm font-bold">{SVC_META[k].icon} {SVC_META[k].label}</td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{formatDate(s.date)}</td>
                  <td className="px-4 py-3 font-mono text-xs font-extrabold" style={{color:col}}>{lbl}</td>
                  <td className="px-4 py-3 text-sm font-bold">{j.pic}</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{color:'#888880'}}>{j.phone}</td>
                </tr>
              )
            })}
            {!upcoming.length && (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-3">🎉</div>
                <div className="text-sm font-bold tracking-widest uppercase">No upcoming deadlines in the next 14 days</div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}