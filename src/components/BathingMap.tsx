import L from 'leaflet'
import { useEffect } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import type { BathingSpot } from '../data/types'
import { statusMeta } from '../lib/format'
import { StatusPill } from './StatusPill'
import 'leaflet/dist/leaflet.css'

type BathingMapProps = {
  spots: BathingSpot[]
  selectedSpot: BathingSpot | null
  userLocation: GeolocationPosition | null
  onSelect: (spot: BathingSpot) => void
}

const berlinCenter: [number, number] = [52.51, 13.405]

export function BathingMap({ spots, selectedSpot, userLocation, onSelect }: BathingMapProps) {
  return (
    <MapContainer center={berlinCenter} zoom={10} className="h-full w-full" zoomControl={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapResize />
      <MapFocus spot={selectedSpot} userLocation={userLocation} />
      {spots.map((spot) => (
        <Marker key={spot.id} position={[spot.latitude, spot.longitude]} icon={markerIcon(statusMeta[spot.status].marker)} eventHandlers={{ click: () => onSelect(spot) }}>
          <Popup>
            <div className="min-w-48">
              <p className="font-semibold text-slate-950">{spot.name}</p>
              <p className="mb-2 text-sm text-slate-500">{spot.district}</p>
              <StatusPill status={spot.status} />
            </div>
          </Popup>
        </Marker>
      ))}
      {userLocation ? (
        <Marker
          position={[userLocation.coords.latitude, userLocation.coords.longitude]}
          icon={markerIcon('#0284c7', true)}
        />
      ) : null}
    </MapContainer>
  )
}

function MapResize() {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => map.invalidateSize())
    })

    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [map])

  return null
}

function MapFocus({ spot, userLocation }: { spot: BathingSpot | null; userLocation: GeolocationPosition | null }) {
  const map = useMap()

  useEffect(() => {
    if (spot) {
      map.flyTo([spot.latitude, spot.longitude], Math.max(map.getZoom(), 13), { duration: 0.7 })
    } else if (userLocation) {
      map.flyTo([userLocation.coords.latitude, userLocation.coords.longitude], 12, { duration: 0.7 })
    }
  }, [map, spot, userLocation])

  return null
}

function markerIcon(color: string, outlined = false) {
  return L.divIcon({
    className: '',
    html: `<span style="background:${color};border:${outlined ? '3px solid white' : '2px solid white'};box-shadow:0 8px 18px rgba(15,23,42,.25)" class="block h-4 w-4 rounded-full"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}
