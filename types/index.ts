// types/index.ts

export type Role = 'master' | 'team' | 'client'
export type ServiceKey = 'flyer' | 'posm' | 'bunting'

export interface ServiceEntry {
  date: string
  done: boolean
}

export interface TimelineStage {
  lbl: string
  icon: string
}

export interface Job {
  id: string
  name: string
  code: string
  state: string
  addr: string
  pic: string
  phone: string
  services: Partial<Record<ServiceKey, ServiceEntry>>
  timeline: boolean
  tl_stages: Partial<Record<ServiceKey, number>>
  created_by: string
  created_at: string
  updated_at: string
}

export interface AppUser {
  id: string
  name: string
  username: string
  role: Role
  created_at: string
}

export interface TelegramConfig {
  token: string
  chat_id: string
}

export const SVC_META: Record<ServiceKey, { icon: string; label: string; hint: string }> = {
  flyer:   { icon: '📄', label: 'Flyer Distribution', hint: 'Distribution Start Date' },
  posm:    { icon: '📦', label: 'POSM to Store',       hint: 'Send-By Date' },
  bunting: { icon: '🚩', label: 'Street Buntings',     hint: 'Installation Date' },
}

export const TL_STAGES: Record<ServiceKey, TimelineStage[]> = {
  flyer: [
    { lbl: 'Order Received',           icon: '📋' },
    { lbl: 'Printing in Progress',     icon: '🖨️' },
    { lbl: 'Distribution in Progress', icon: '🚶' },
    { lbl: 'Distribution Completed',   icon: '✅' },
  ],
  posm: [
    { lbl: 'Order Received',       icon: '📋' },
    { lbl: 'Printing in Progress', icon: '🖨️' },
    { lbl: 'In Transit',           icon: '🚚' },
    { lbl: 'Delivered to Store',   icon: '📦' },
  ],
  bunting: [
    { lbl: 'Order Received',       icon: '📋' },
    { lbl: 'Printing in Progress', icon: '🖨️' },
    { lbl: 'Buntings Installed',   icon: '🚩' },
    { lbl: 'Buntings Dismantled',  icon: '🚧' },
  ],
}


export const MALAYSIAN_STATES = [
  'Johor','Kedah','Kelantan','Melaka','Negeri Sembilan',
  'Pahang','Perak','Perlis','Pulau Pinang','Sabah','Sarawak',
  'Selangor','Terengganu','W.P. Kuala Lumpur','W.P. Labuan','W.P. Putrajaya',
]
