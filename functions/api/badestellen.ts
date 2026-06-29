type Env = {
  BADESTELLEN_SOURCE_URL?: string
  BADESTELLEN_METADATA_URL?: string
  BADESTELLEN_SOURCE_NAME?: string
  BADESTELLEN_SOURCE_LINK?: string
  BADESTELLEN_CACHE_SECONDS?: string
}

const defaultMeasurementsUrl = 'https://www.data.lageso.de/baden/00_History_gesamt/History.csv'
const defaultMetadataUrl = 'https://datawrapper.dwcdn.net/RmRRt/30/dataset.csv'

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const cacheSeconds = Number(env.BADESTELLEN_CACHE_SECONDS ?? 900)
  const sourceUrl = env.BADESTELLEN_SOURCE_URL ?? defaultMeasurementsUrl
  const metadataUrl = env.BADESTELLEN_METADATA_URL ?? defaultMetadataUrl

  const cacheKey = new Request(new URL(request.url).toString(), request)
  const cached = await caches.default.match(cacheKey)
  if (cached) {
    return withCors(cached)
  }

  const [body, metadata] = await Promise.all([
    fetchSource(sourceUrl, cacheSeconds),
    fetchSource(metadataUrl, cacheSeconds),
  ])

  // Keep this proxy deliberately thin. Source-specific field mapping belongs in
  // src/data/adapter.ts so the UI can consume one stable shape while official
  // Berlin feeds are swapped or improved over time.
  const response = json(
    {
      sourceName: env.BADESTELLEN_SOURCE_NAME ?? 'Berlin official bathing-water data',
      sourceUrl: env.BADESTELLEN_SOURCE_LINK ?? sourceUrl,
      fetchedAt: new Date().toISOString(),
      cacheSeconds,
      data: body,
      metadata,
    },
    200,
    cacheSeconds,
  )

  await caches.default.put(cacheKey, response.clone())
  return response
}

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, {
    status: 204,
    headers: corsHeaders(),
  })

function json(body: unknown, status: number, cacheSeconds: number) {
  return withCors(
    Response.json(body, {
      status,
      headers: {
        'Cache-Control': `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}, stale-while-revalidate=86400`,
      },
    }),
  )
}

function withCors(response: Response) {
  const next = new Response(response.body, response)
  for (const [key, value] of Object.entries(corsHeaders())) {
    next.headers.set(key, value)
  }
  return next
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

async function fetchSource(url: string, cacheSeconds: number): Promise<unknown> {
  const upstream = await fetch(url, {
    headers: {
      Accept: 'application/json, text/csv;q=0.9, */*;q=0.1',
      'User-Agent': 'Badestellen-Berlin/1.0 (+Cloudflare Pages)',
    },
    cf: { cacheTtl: cacheSeconds, cacheEverything: true },
  })

  if (!upstream.ok) {
    throw new Error(`Source returned ${upstream.status}`)
  }

  const contentType = upstream.headers.get('content-type') ?? ''
  return contentType.includes('json') ? upstream.json() : parseCsv(await upstream.text())
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
