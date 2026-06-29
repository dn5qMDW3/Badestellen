# Berlin Bathing Waters

Mobile-first React app for Berlin bathing waters. It shows bathing locations on an interactive Leaflet map and in a searchable list with current suitability, latest measurements, water temperature, visibility, district, and official profile links.

## Stack

- Vite + React + TypeScript
- Tailwind CSS
- Leaflet via `react-leaflet`
- Cloudflare Pages
- Optional Cloudflare Pages Function at `/api/badestellen` for source proxying and edge caching

## Local Development

```bash
npm install
npm run dev
```

The Vite dev server prints the local URL, usually `http://localhost:5173`.

Run checks:

```bash
npm run lint
npm run build
```

## Data Sources

The UI consumes one normalized shape from `src/data/types.ts`. Source-specific parsing lives in `src/data/adapter.ts`.

The app prefers `/api/badestellen`, which is implemented as a Cloudflare Pages Function. By default the function uses LAGeSo's official current-season history CSV and the Berlin/Datawrapper metadata CSV embedded on the official bathing-water page. The function does not scrape HTML.

If `/api/badestellen` is missing in plain Vite local development, the browser tries those official CSV URLs directly. If the official sources are unavailable, the app falls back to a small clearly marked demo dataset in `src/data/fallbackSpots.ts`.

## Environment Variables

Create a local `.env` from `.env.example` when needed:

```bash
cp .env.example .env
```

Frontend:

- `VITE_BADESTELLEN_API_URL`: API URL used by the browser. Defaults to `/api/badestellen`.

Cloudflare Pages Function:

- `BADESTELLEN_SOURCE_URL`: LAGeSo measurements CSV. Defaults to `https://www.data.lageso.de/baden/00_History_gesamt/History.csv`.
- `BADESTELLEN_METADATA_URL`: Berlin/Datawrapper metadata CSV with coordinates and profile links. Defaults to `https://datawrapper.dwcdn.net/RmRRt/30/dataset.csv`.
- `BADESTELLEN_SOURCE_NAME`: display name for the data source.
- `BADESTELLEN_SOURCE_LINK`: public source/profile page shown in the UI.
- `BADESTELLEN_CACHE_SECONDS`: public cache duration. Default recommendation: `900` seconds.

## Cloudflare Pages

Build command:

```bash
npm run build
```

Output directory:

```text
dist
```

Deployment steps:

1. Create a Cloudflare Pages project connected to this repository.
2. Set the build command to `npm run build`.
3. Set the build output directory to `dist`.
4. Add the environment variables above in the Pages dashboard, especially `BADESTELLEN_SOURCE_URL`.
5. Deploy. Cloudflare automatically publishes the static app and the `/api/badestellen` Pages Function.

`wrangler.toml` is included with `pages_build_output_dir = "dist"` and default non-secret variables. Keep source URLs and any future tokens in the Cloudflare dashboard rather than committing them.

## Caching

`/api/badestellen` returns:

```text
Cache-Control: public, max-age=900, s-maxage=900, stale-while-revalidate=86400
```

Tune `BADESTELLEN_CACHE_SECONDS` based on the update cadence of the official source. KV is not used by default; add it only if the remote source is slow or unreliable. D1 is unnecessary unless historical measurements are stored.