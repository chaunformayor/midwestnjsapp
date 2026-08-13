import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmtDate(date: string | null | undefined, fmt = 'MMM d, yyyy') {
  if (!date) return '—'
  return format(new Date(date), fmt)
}

export function fmtDateTime(date: string | null | undefined) {
  return fmtDate(date, 'MMM d, yyyy · h:mm a')
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export const DEAL_STATUSES = [
  { value: 'submitted',      label: 'Submitted',      color: 'bg-blue-100 text-blue-800' },
  { value: 'reviewing',      label: 'Reviewing',      color: 'bg-yellow-100 text-yellow-800' },
  { value: 'presented',      label: 'Presented',      color: 'bg-purple-100 text-purple-800' },
  { value: 'under_contract', label: 'Under Contract', color: 'bg-orange-100 text-orange-800' },
  { value: 'closed',         label: 'Closed',         color: 'bg-green-100 text-green-800' },
  { value: 'passed',         label: 'Passed',         color: 'bg-gray-100 text-gray-600' },
] as const

export const CONTACT_STATUSES = [
  { value: 'new',      label: 'New',      color: 'bg-blue-100 text-blue-800' },
  { value: 'read',     label: 'Read',     color: 'bg-gray-100 text-gray-600' },
  { value: 'replied',  label: 'Replied',  color: 'bg-green-100 text-green-800' },
  { value: 'archived', label: 'Archived', color: 'bg-gray-100 text-gray-400' },
] as const

export const POST_CATEGORIES = [
  { value: 'market-report',  label: 'Market Report' },
  { value: 'deal-breakdown', label: 'Deal Breakdown' },
  { value: 'strategy',       label: 'Strategy' },
  { value: 'education',      label: 'Investor Education' },
] as const
