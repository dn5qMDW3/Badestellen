import { AlertCircle, LocateFixed, Search, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { BathingMap } from './components/BathingMap'
import { BathingSpotCard } from './components/BathingSpotCard'
import { SpotDetail } from './components/SpotDetail'
import { getBathingWaters } from './data/adapter'
import type { BathingSpot, BathingStatus, BathingWaterResponse } from './data/types'
import { formatDateTime } from './lib/format'

type LoadState = 'loading' | 'ready' | 'error'
type FilterValue = BathingStatus | 'all'

const filters: { value: FilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'suitable', label: 'Suitable' },
  { value: 'watch', label: 'Watch' },
  { value: 'unsuitable', label: 'Not suitable' },
  { value: 'unknown', label: 'Unknown' },
]

function App() {
  const [data, setData] = useState<BathingWaterResponse | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<FilterValue>('all')
  const [selectedSpot, setSelectedSpot] = useState<BathingSpot | null>(null)
  const [userLocation, setUserLocation] = useState<GeolocationPosition | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    getBathingWaters()
      .then((response) => {
        if (!isMounted) return
        setData(response)
        setSelectedSpot(response.spots[0] ?? null)
        setLoadState('ready')
      })
      .catch(() => {
        if (!isMounted) return
        setLoadState('error')
      })

    return () => {
      isMounted = false
    }
  }, [])

  const filteredSpots = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (data?.spots ?? []).filter((spot) => {
      const matchesQuery = !needle || `${spot.name} ${spot.district}`.toLowerCase().includes(needle)
      const matchesStatus = status === 'all' || spot.status === status
      return matchesQuery && matchesStatus
    })
  }, [data?.spots, query, status])

  useEffect(() => {
    if (!selectedSpot && filteredSpots.length > 0) {
      setSelectedSpot(filteredSpots[0])
    }
    if (selectedSpot && !filteredSpots.some((spot) => spot.id === selectedSpot.id)) {
      setSelectedSpot(filteredSpots[0] ?? null)
    }
  }, [filteredSpots, selectedSpot])

  function locateUser() {
    setGeoError(null)

    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by this browser.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => setUserLocation(position),
      () => setGeoError('Could not determine your location. Please check browser permission.'),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  return (
    <main className="h-svh overflow-hidden bg-slate-50 text-slate-900">
      <div className="flex h-full flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_440px]">
        <section className="relative min-h-0 flex-1">
          <BathingMap spots={filteredSpots} selectedSpot={selectedSpot} userLocation={userLocation} onSelect={setSelectedSpot} />

          <header className="pointer-events-none absolute inset-x-0 top-0 z-[500] p-3 sm:p-4">
            <div className="pointer-events-auto mx-auto max-w-3xl rounded-lg border border-white/60 bg-white/95 p-3 shadow-lg backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Berlin Bathing Waters</p>
                  <h1 className="text-lg font-bold leading-tight text-slate-950 sm:text-2xl">Check bathing water status</h1>
                </div>
                <button type="button" className="btn-primary shrink-0" onClick={locateUser}>
                  <LocateFixed className="h-4 w-4" />
                  <span className="hidden sm:inline">Near me</span>
                </button>
              </div>
              {geoError ? <p className="mt-2 text-sm text-rose-700">{geoError}</p> : null}
            </div>
          </header>
        </section>

        <aside className="z-[600] max-h-[62svh] overflow-hidden rounded-t-2xl border-t border-slate-200 bg-slate-50 shadow-2xl lg:max-h-none lg:rounded-none lg:border-l lg:border-t-0">
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-slate-200 bg-white p-4">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 lg:hidden" />
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{filteredSpots.length} bathing spots</p>
                  <p className="text-xs text-slate-500">
                    Data updated {data ? formatDateTime(data.fetchedAt) : 'loading'}
                  </p>
                </div>
                {query || status !== 'all' ? (
                  <button type="button" className="icon-button" onClick={() => { setQuery(''); setStatus('all') }} aria-label="Reset filters">
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              <label className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-100">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name or district"
                />
              </label>

              <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
                <SlidersHorizontal className="h-4 w-4 shrink-0 text-slate-400" />
                {filters.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${
                      status === filter.value ? 'bg-cyan-700 text-white ring-cyan-700' : 'bg-white text-slate-700 ring-slate-200'
                    }`}
                    onClick={() => setStatus(filter.value)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {loadState === 'loading' ? <StateMessage title="Loading bathing spots" message="Preparing measurements and map points." /> : null}
              {loadState === 'error' ? <StateMessage title="Data could not be loaded" message="Please try again later." isError /> : null}
              {loadState === 'ready' && filteredSpots.length === 0 ? (
                <StateMessage title="No results" message="Adjust the search or filters." />
              ) : null}

              {selectedSpot ? <SpotDetail spot={selectedSpot} /> : null}

              <div className="mt-4 grid gap-3">
                {filteredSpots.map((spot) => (
                  <BathingSpotCard
                    key={spot.id}
                    spot={spot}
                    isSelected={spot.id === selectedSpot?.id}
                    userLocation={userLocation}
                    onSelect={setSelectedSpot}
                  />
                ))}
              </div>
            </div>

            {data ? (
              <footer className="border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
                Source:{' '}
                <a className="font-semibold text-cyan-700 hover:text-cyan-900" href={data.sourceUrl} target="_blank" rel="noreferrer">
                  {data.sourceName}
                </a>
                {' '}· Cache {Math.round(data.cacheSeconds / 60)} Min.
              </footer>
            ) : null}
          </div>
        </aside>
      </div>
    </main>
  )
}

function StateMessage({ title, message, isError = false }: { title: string; message: string; isError?: boolean }) {
  return (
    <div className={`mb-4 rounded-lg border p-4 ${isError ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-slate-200 bg-white text-slate-700'}`}>
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-sm">{message}</p>
        </div>
      </div>
    </div>
  )
}

export default App
