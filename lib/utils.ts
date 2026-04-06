// lib/utils.ts
import { Job, ServiceKey, SVC_META } from '@/types'

export function daysFromNow(dateStr: string): number | null {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0,0,0,0)
  const d = new Date(dateStr); d.setHours(0,0,0,0)
  return Math.round((d.getTime() - today.getTime()) / 86400000)
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr); d.setHours(12)
  return d.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function svcStatus(s: { date: string; done: boolean }): 'done' | 'overdue' | 'soon' | 'ok' {
  if (s.done) return 'done'
  const d = daysFromNow(s.date)
  if (d === null) return 'ok'
  if (d < 0) return 'overdue'
  if (d <= 3) return 'soon'
  return 'ok'
}

export function jobOverdue(j: Job): boolean {
  return Object.values(j.services).some(s => s && !s.done && (daysFromNow(s.date) ?? 0) < 0)
}

export function jobAllDone(j: Job): boolean {
  const svcs = Object.values(j.services)
  return svcs.length > 0 && svcs.every(s => s?.done)
}

export function jobPending(j: Job): boolean {
  return Object.values(j.services).some(s => s && !s.done) && !jobOverdue(j)
}

export function countdownLabel(d: number | null, done: boolean): { label: string; cls: string } {
  if (done) return { label: 'Done', cls: 'done' }
  if (d === null) return { label: '—', cls: 'ok' }
  if (d < 0) return { label: `${Math.abs(d)}d overdue`, cls: 'overdue' }
  if (d === 0) return { label: 'TODAY', cls: 'today' }
  if (d <= 3) return { label: `${d}d left`, cls: 'soon' }
  return { label: `${d}d left`, cls: 'ok' }
}

export function buildTelegramJobMsg(j: Job, isNew: boolean, svcMeta: typeof SVC_META): string {
  const svcs = Object.entries(j.services)
    .map(([k, s]) => `  ${svcMeta[k as ServiceKey].icon} *${svcMeta[k as ServiceKey].label}* — ${formatDate(s!.date)}`)
    .join('\n')
  return `🔧 *MR DIY Job Tracker*\n\n${isNew ? '🆕 New Job' : '✏️ Job Updated'}\n\n` +
    `📍 *${j.name}*\n🔑 \`${j.code}\` | 📌 ${j.state}\n` +
    `👤 ${j.pic || '—'} | 📞 ${j.phone || '—'}\n\n*Services:*\n${svcs}`
}

export function buildTelegramReminderMsg(j: Job, svc: ServiceKey, svcMeta: typeof SVC_META): string {
  return `🔔 *MR DIY Reminder*\n\n` +
    `${svcMeta[svc].icon} *${svcMeta[svc].label}* is due *TOMORROW*!\n\n` +
    `📍 *${j.name}*\n🔑 \`${j.code}\` | 📌 ${j.state}\n` +
    `👤 ${j.pic || '—'} | 📞 ${j.phone || '—'}\n` +
    `📅 Date: *${formatDate(j.services[svc]!.date)}*`
}
