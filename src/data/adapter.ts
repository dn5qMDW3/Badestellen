import { fallbackSpots } from './fallbackSpots'
import type { BathingSpot, BathingStatus, BathingWaterResponse } from './types'

const officialMeasurementsUrl = 'https://www.data.lageso.de/baden/00_History_gesamt/History.csv'
const officialMetadataUrl = 'https://datawrapper.dwcdn.net/RmRRt/30/dataset.csv'

const localFallback: BathingWaterResponse = {
  spots: fallbackSpots,
  sourceName: 'LAGeSo Berlin / local fallback',
  sourceUrl: 'https://www.berlin.de/lageso/gesundheit/gesundheitsschutz/badegewaesser/',
  fetchedAt: new Date().toISOString(),
  cacheSeconds: 900,
}

export async function getBathingWaters(): Promise<BathingWaterResponse> {
  const endpoint = import.meta.env.VITE_BADESTELLEN_API_URL ?? '/api/badestellen'

  try {
    const response = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`Badestellen API returned ${response.status}`)
    }

    const contentType = response.headers.get('content-type') ?? ''
    const body = contentType.includes('json') ? await response.json() : await response.text()
    return normalizeBathingWaterResponse(body)
  } catch (error) {
    console.warn('Primary bathing-water API failed, trying official CSV sources.', error)
    return getOfficialCsvData()
  }
}

export function normalizeBathingWaterResponse(payload: unknown): BathingWaterResponse {
  if (typeof payload === 'string') {
    return mergeOfficialRows(parseCsv(payload), [])
  }

  if (isBathingWaterResponse(payload)) {
    return payload
  }

  if (Array.isArray(payload)) {
    return {
      ...localFallback,
      spots: payload.map(normalizeSpot).filter(Boolean) as BathingSpot[],
      fetchedAt: new Date().toISOString(),
    }
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    const nestedData = record.data && typeof record.data === 'object' ? (record.data as Record<string, unknown>) : null
    const sourceRows = Array.isArray(record.data) ? record.data : null
    const metadataRows = Array.isArray(record.metadata) ? record.metadata : []

    if (sourceRows) {
      return mergeOfficialRows(sourceRows, metadataRows, {
        fetchedAt: stringFrom(record.fetchedAt),
        sourceName: stringFrom(record.sourceName),
        sourceUrl: stringFrom(record.sourceUrl),
        cacheSeconds: numberFrom(record.cacheSeconds) ?? undefined,
      })
    }

    const rawSpots = firstArray(
      record.spots,
      record.features,
      record.data,
      record.results,
      record.items,
      nestedData?.spots,
      nestedData?.features,
      nestedData?.results,
      nestedData?.items,
    )

    if (rawSpots) {
      return {
        spots: rawSpots.map(normalizeSpot).filter(Boolean) as BathingSpot[],
        sourceName: stringFrom(record.sourceName) ?? 'Berlin bathing-water data',
        sourceUrl: stringFrom(record.sourceUrl) ?? localFallback.sourceUrl,
        fetchedAt: stringFrom(record.fetchedAt) ?? new Date().toISOString(),
        cacheSeconds: numberFrom(record.cacheSeconds) ?? 900,
      }
    }
  }

  return localFallback
}

async function getOfficialCsvData(): Promise<BathingWaterResponse> {
  try {
    const [measurements, metadata] = await Promise.all([
      fetchCsv(officialMeasurementsUrl),
      fetchCsv(officialMetadataUrl),
    ])
    return mergeOfficialRows(measurements, metadata)
  } catch (error) {
    console.warn('Using local bathing-water fallback data.', error)
    return localFallback
  }
}

async function fetchCsv(url: string): Promise<Record<string, string>[]> {
  const response = await fetch(url, { headers: { Accept: 'text/csv,*/*;q=0.1' } })
  if (!response.ok) {
    throw new Error(`Official CSV returned ${response.status}`)
  }
  return parseCsv(await response.text())
}

function mergeOfficialRows(
  measurementRows: unknown[],
  metadataRows: unknown[],
  options: Partial<Pick<BathingWaterResponse, 'fetchedAt' | 'sourceName' | 'sourceUrl' | 'cacheSeconds'>> = {},
): BathingWaterResponse {
  const metadataByName = new Map<string, Record<string, string>>()

  for (const rawMeta of metadataRows) {
    if (!rawMeta || typeof rawMeta !== 'object') continue
    const meta = rawMeta as Record<string, string>
    const name = meta.BadName
    if (name) metadataByName.set(normalizeName(name), meta)
  }

  const latestByName = new Map<string, Record<string, string>>()
  for (const rawMeasurement of measurementRows) {
    if (!rawMeasurement || typeof rawMeasurement !== 'object') continue
    const measurement = rawMeasurement as Record<string, string>
    const name = measurement.BadName
    const date = parseGermanDate(measurement.Prob_Datum)
    if (!name || !date) continue

    const key = normalizeName(name)
    const previous = latestByName.get(key)
    const previousDate = previous ? parseGermanDate(previous.Prob_Datum) : null
    if (!previousDate || date > previousDate) {
      latestByName.set(key, measurement)
    }
  }

  const spots = [...latestByName.entries()]
    .map(([key, measurement]) => {
      const meta = metadataByName.get(key)
      const lat = parseGermanNumber(meta?.Latitude)
      const lng = parseGermanNumber(meta?.Longitude)
      if (lat === null || lng === null) return null

      const status = statusFromLagesoColor(measurement.Farbe || meta?.Farbe || '')
      const warnings = cleanGermanNone(measurement['Aktuelle Warnhinweise'])
      const hints = cleanGermanNone(measurement['Weitere Informationen'])
      const date = parseGermanDate(measurement.Prob_Datum)
      const visibilityM = parseGermanNumber(measurement['Sichttiefe <br> (m)'])

      return {
        id: slugify(measurement.BadName),
        name: measurement.BadName,
        district: meta?.Bezirk || 'Berlin',
        status,
        statusLabel: labelFromStatus(status, warnings),
        latestMeasurementAt: date?.toISOString() ?? null,
        waterTemperatureC: parseGermanNumber(measurement['Wassertemperatur <br> (°C)']),
        visibilityCm: visibilityM === null ? null : Math.round(visibilityM * 100),
        ecoli: parseGermanNumber(measurement['Escherichia coli<br> (KBE/ 100 ml)']),
        intestinalEnterococci: parseGermanNumber(measurement['Intestinale Enterokokken<br> (KBE/ 100 ml)']),
        latitude: lat,
        longitude: lng,
        profileUrl: absoluteBerlinUrl(meta?.BadestelleLink || meta?.ProfilLink),
        sourceUrl: officialMeasurementsUrl,
        notes: [warnings, hints].filter(Boolean).join(' '),
      } satisfies BathingSpot
    })
    .filter(Boolean) as BathingSpot[]

  return {
    spots: spots.sort((a, b) => a.name.localeCompare(b.name, 'de')),
    sourceName: options.sourceName ?? 'LAGeSo Berlin official bathing-water data',
    sourceUrl: options.sourceUrl ?? officialMeasurementsUrl,
    fetchedAt: options.fetchedAt ?? new Date().toISOString(),
    cacheSeconds: options.cacheSeconds ?? 900,
  }
}

// This adapter intentionally accepts several common Open Data shapes:
// already-normalized JSON, arrays of records, GeoJSON FeatureCollections, and
// CKAN-style result wrappers. When Berlin changes the structured source, keep
// the rest of the UI stable by only updating the field extraction below.
function normalizeSpot(raw: unknown): BathingSpot | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const record = raw as Record<string, unknown>
  const props = ((record.properties as Record<string, unknown> | undefined) ?? record)
  const coordinates = getCoordinates(record)
  const id = stringFrom(props.id, props.ID, props.objectid, props.slug, props.name, props.Name)
  const name = stringFrom(props.name, props.Name, props.bezeichnung, props.Badestelle, props.BAD_NAME)

  if (!id || !name || !coordinates) {
    return null
  }

  return {
    id: slugify(id),
    name,
    district: stringFrom(props.district, props.bezirk, props.Bezirk, props.BEZIRK) ?? 'Berlin',
    status: normalizeStatus(stringFrom(props.status, props.ampel, props.qualitaet, props.Quality)),
    statusLabel: stringFrom(props.statusLabel, props.ampelText, props.qualitaet_text, props.QualityText) ?? 'Status unbekannt',
    latestMeasurementAt: stringFrom(props.latestMeasurementAt, props.datum, props.Probenahme, props.date) ?? null,
    waterTemperatureC: numberFrom(props.waterTemperatureC, props.wassertemperatur, props.Wassertemperatur, props.temp),
    visibilityCm: numberFrom(props.visibilityCm, props.sichttiefe, props.Sichttiefe),
    ecoli: numberFrom(props.ecoli, props.escherichia_coli, props.EColi),
    intestinalEnterococci: numberFrom(props.intestinalEnterococci, props.enterokokken, props.Enterokokken),
    latitude: coordinates[0],
    longitude: coordinates[1],
    profileUrl: stringFrom(props.profileUrl, props.link, props.url) ?? localFallback.sourceUrl,
    sourceUrl: stringFrom(props.sourceUrl, props.source, props.quelle) ?? localFallback.sourceUrl,
    notes: stringFrom(props.notes, props.hinweis),
  }
}

function getCoordinates(record: Record<string, unknown>): [number, number] | null {
  const props = (record.properties as Record<string, unknown> | undefined) ?? record
  const lat = numberFrom(props.latitude, props.lat, props.Latitude, props.Breitengrad, props.Y)
  const lng = numberFrom(props.longitude, props.lng, props.lon, props.Longitude, props.Laengengrad, props.Längengrad, props.X)

  if (lat !== null && lng !== null) {
    return [lat, lng]
  }

  const geometry = record.geometry as Record<string, unknown> | undefined
  if (geometry?.type === 'Point' && Array.isArray(geometry.coordinates)) {
    const [longitude, latitude] = geometry.coordinates
    const parsedLat = numberFrom(latitude)
    const parsedLng = numberFrom(longitude)
    return parsedLat !== null && parsedLng !== null ? [parsedLat, parsedLng] : null
  }

  return null
}

function isBathingWaterResponse(payload: unknown): payload is BathingWaterResponse {
  return Boolean(
    payload &&
      typeof payload === 'object' &&
      Array.isArray((payload as BathingWaterResponse).spots) &&
      typeof (payload as BathingWaterResponse).sourceName === 'string',
  )
}

function firstArray(...values: unknown[]): unknown[] | null {
  for (const value of values) {
    if (Array.isArray(value)) {
      return value
    }
  }
  return null
}

function stringFrom(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
    if (typeof value === 'number') {
      return String(value)
    }
  }
}

function numberFrom(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string') {
      const parsed = Number(value.replace(',', '.').replace(/[^\d.-]/g, ''))
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }
  return null
}

function normalizeStatus(value?: string): BathingStatus {
  const lower = value?.toLowerCase() ?? ''
  if (/(ungeeignet|gesperrt|rot|poor|bad|unsuitable)/.test(lower)) return 'unsuitable'
  if (/(warn|auffällig|gelb|watch|hinweis)/.test(lower)) return 'watch'
  if (/(geeignet|grün|gut|excellent|suitable)/.test(lower)) return 'suitable'
  return 'unknown'
}

function statusFromLagesoColor(value: string): BathingStatus {
  const lower = value.toLowerCase()
  if (lower.includes('rot')) return 'unsuitable'
  if (lower.includes('gelb')) return 'watch'
  if (lower.includes('gruen') || lower.includes('grün')) return 'suitable'
  return 'unknown'
}

function labelFromStatus(status: BathingStatus, warning: string | null): string {
  if (warning) return warning
  if (status === 'suitable') return 'Suitable for bathing'
  if (status === 'watch') return 'Advisory active'
  if (status === 'unsuitable') return 'Not suitable for bathing'
  return 'No current assessment'
}

function cleanGermanNone(value?: string): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return !trimmed || trimmed.toLowerCase() === 'keine' ? null : trimmed
}

function parseGermanDate(value?: string): Date | null {
  if (!value) return null
  const [day, month, year] = value.split('.').map(Number)
  if (!day || !month || !year) return null
  return new Date(Date.UTC(year, month - 1, day, 10, 0, 0))
}

function parseGermanNumber(value?: string): number | null {
  if (!value || /n\.?a\.?|^k\.?a\.?$/i.test(value.trim())) return null
  const cleaned = value.replace(',', '.').replace(/[^\d.-]/g, '')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function absoluteBerlinUrl(value?: string): string {
  if (!value) return 'https://www.berlin.de/lageso/gesundheit/gesundheitsschutz/badegewaesser/'
  const match = value.match(/https?:\/\/[^" ]+|\/lageso\/[^" ]+/)
  const url = match?.[0] ?? value
  if (url.startsWith('http')) return url
  return `https://www.berlin.de${url.startsWith('/') ? url : `/${url}`}`
}

function normalizeName(value: string): string {
  return value.trim().normalize('NFC').toLowerCase()
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function parseCsv(input: string): Record<string, string>[] {
  const delimiter = input.split('\n', 1)[0]?.includes(';') ? ';' : ','
  const rows: string[][] = []
  let cell = ''
  let row: string[] = []
  let quoted = false

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    const next = input[index + 1]

    if (char === '"' && quoted && next === '"') {
      cell += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === delimiter && !quoted) {
      row.push(cell)
      cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1
      row.push(cell)
      if (row.some(Boolean)) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }

  row.push(cell)
  if (row.some(Boolean)) rows.push(row)

  const headers = rows.shift()?.map((header) => header.trim()) ?? []
  return rows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ''])),
  )
}
