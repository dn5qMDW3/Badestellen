export type BathingStatus = 'suitable' | 'watch' | 'unsuitable' | 'unknown'

export type BathingSpot = {
  id: string
  name: string
  district: string
  status: BathingStatus
  statusLabel: string
  latestMeasurementAt: string | null
  waterTemperatureC: number | null
  visibilityCm: number | null
  ecoli: number | null
  intestinalEnterococci: number | null
  latitude: number
  longitude: number
  profileUrl: string
  sourceUrl: string
  notes?: string
}

export type BathingWaterResponse = {
  spots: BathingSpot[]
  sourceName: string
  sourceUrl: string
  fetchedAt: string
  cacheSeconds: number
}
