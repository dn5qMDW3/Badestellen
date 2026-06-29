import { ExternalLink, MapPin, Waves } from 'lucide-react'
import type { BathingSpot } from '../data/types'
import { distanceKm, formatDateTime, formatNumber } from '../lib/format'
import { StatusPill } from './StatusPill'

type BathingSpotCardProps = {
  spot: BathingSpot
  isSelected?: boolean
  userLocation: GeolocationPosition | null
  onSelect: (spot: BathingSpot) => void
}

export function BathingSpotCard({ spot, isSelected, userLocation, onSelect }: BathingSpotCardProps) {
  const distance = distanceKm(userLocation, spot.latitude, spot.longitude)

  return (
    <article
      className={`rounded-lg border bg-white p-4 text-left shadow-sm transition hover:border-cyan-300 ${
        isSelected ? 'border-cyan-500 ring-2 ring-cyan-100' : 'border-slate-200'
      }`}
    >
      <button type="button" className="block w-full text-left" onClick={() => onSelect(spot)}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold leading-tight text-slate-950">{spot.name}</h3>
            <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
              <MapPin className="h-3.5 w-3.5" />
              {spot.district}
              {distance !== null ? ` · ${formatNumber(distance, 'km')}` : ''}
            </p>
          </div>
          <StatusPill status={spot.status} />
        </div>
      </button>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-slate-500">Measurement</dt>
          <dd className="font-medium text-slate-900">{formatDateTime(spot.latestMeasurementAt)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Temperature</dt>
          <dd className="font-medium text-slate-900">{formatNumber(spot.waterTemperatureC, '°C')}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Visibility</dt>
          <dd className="font-medium text-slate-900">{formatNumber(spot.visibilityCm, 'cm')}</dd>
        </div>
        <div>
          <dt className="text-slate-500">E. coli</dt>
          <dd className="font-medium text-slate-900">{formatNumber(spot.ecoli, 'CFU/100 ml')}</dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-xs text-slate-500">
          <Waves className="h-4 w-4 shrink-0 text-cyan-600" />
          <span className="truncate">{spot.statusLabel}</span>
        </p>
        <a
          className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-cyan-700 hover:text-cyan-900"
          href={spot.profileUrl}
          target="_blank"
          rel="noreferrer"
        >
          Profile
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </article>
  )
}
