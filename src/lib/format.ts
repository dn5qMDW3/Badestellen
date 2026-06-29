import type { BathingStatus } from '../data/types'

export const statusMeta: Record<BathingStatus, { label: string; className: string; marker: string }> = {
  suitable: {
    label: 'Suitable',
    className: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    marker: '#059669',
  },
  watch: {
    label: 'Watch',
    className: 'bg-amber-50 text-amber-800 ring-amber-200',
    marker: '#d97706',
  },
  unsuitable: {
    label: 'Not suitable',
    className: 'bg-rose-50 text-rose-800 ring-rose-200',
    marker: '#e11d48',
  },
  unknown: {
    label: 'Unknown',
    className: 'bg-slate-100 text-slate-700 ring-slate-200',
    marker: '#64748b',
  },
}

export function formatDateTime(value: string | null): string {
  if (!value) return 'No current measurement'
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function formatNumber(value: number | null, suffix: string): string {
  if (value === null) return 'n/a'
  return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(value)} ${suffix}`
}

export function distanceKm(from: GeolocationPosition | null, lat: number, lng: number): number | null {
  if (!from) return null
  const radiusKm = 6371
  const dLat = toRad(lat - from.coords.latitude)
  const dLng = toRad(lng - from.coords.longitude)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.coords.latitude)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2
  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRad(value: number): number {
  return (value * Math.PI) / 180
}
