import { ExternalLink, Navigation } from 'lucide-react'
import type { BathingSpot } from '../data/types'
import { formatDateTime, formatNumber } from '../lib/format'
import { StatusPill } from './StatusPill'

type SpotDetailProps = {
  spot: BathingSpot
}

export function SpotDetail({ spot }: SpotDetailProps) {
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${spot.latitude},${spot.longitude}`

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">{spot.district}</p>
          <h2 className="mt-1 text-xl font-bold leading-tight text-slate-950">{spot.name}</h2>
        </div>
        <StatusPill status={spot.status} label={spot.statusLabel} />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <Metric label="Latest measurement" value={formatDateTime(spot.latestMeasurementAt)} wide />
        <Metric label="Water temperature" value={formatNumber(spot.waterTemperatureC, '°C')} />
        <Metric label="Visibility" value={formatNumber(spot.visibilityCm, 'cm')} />
        <Metric label="E. coli" value={formatNumber(spot.ecoli, 'CFU/100 ml')} />
        <Metric label="Enterococci" value={formatNumber(spot.intestinalEnterococci, 'CFU/100 ml')} />
      </dl>

      {spot.notes ? <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">{spot.notes}</p> : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <a className="btn-primary" href={directionsUrl} target="_blank" rel="noreferrer">
          <Navigation className="h-4 w-4" />
          Directions
        </a>
        <a className="btn-secondary" href={spot.profileUrl} target="_blank" rel="noreferrer">
          <ExternalLink className="h-4 w-4" />
          LAGeSo profile
        </a>
      </div>
    </section>
  )
}

function Metric({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-950">{value}</dd>
    </div>
  )
}
