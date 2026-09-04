import { z } from 'zod'
import type { Location } from '../types/location'
import { searchFirstPexelsPhoto } from './pexels'

// Wikivoyage travel-guide API. Keyless: anonymous read queries only need `origin=*` for CORS, so the
// whole discovery flow runs straight from the browser with nothing to expose in the bundle.
const WIKIVOYAGE_API = 'https://en.wikivoyage.org/w/api.php'

// A destination the user might want to research, discovered under a country already on their list.
export interface Suggestion {
  /** Wikivoyage page title — doubles as the display name. */
  name: string
  /** The bucket-list country this was discovered under. */
  country: string
  latitude: number
  longitude: number
  /** One-line intro from Wikivoyage, or undefined for stubs that have none. */
  description?: string
  /** Pexels image searched by place name, else undefined (card shows a placeholder). */
  imageUrl?: string
}

// Default batch size when the caller doesn't specify one. The tray fetches in batches of this size
// and tops up whenever the visible count drops below its own threshold (see useSuggestions).
const DEFAULT_COUNT = 20

// Nominatim (the geocoder feeding `Location.country`) uses English short names; a few don't match
// Wikivoyage's article titles. Only the common mismatches are mapped — anything unmapped is tried
// verbatim and simply fails closed (skipped) if there's no such article.
const COUNTRY_ALIASES: Record<string, string> = {
  'united states': 'United States of America',
  usa: 'United States of America',
  us: 'United States of America',
  'united states of america': 'United States of America',
  'south korea': 'South Korea',
  uae: 'United Arab Emirates',
}

/**
 * GET the Wikivoyage API with the given params (plus `format=json` + `origin=*`). Fails closed like
 * the Pexels helpers: any network error, non-2xx, or parse failure logs and resolves to null — a
 * discovery feature must never throw or block the caller.
 */
async function wikivoyageGet(params: Record<string, string>): Promise<unknown | null> {
  const query = new URLSearchParams({ ...params, format: 'json', origin: '*' })
  const url = `${WIKIVOYAGE_API}?${query.toString()}`

  let response: Response
  try {
    response = await fetch(url)
  } catch (err) {
    console.error('Wikivoyage request failed:', err)
    return null
  }
  if (!response.ok) {
    console.error(`Wikivoyage request failed: ${response.status} ${response.statusText}`)
    return null
  }
  try {
    return await response.json()
  } catch (err) {
    console.error('Wikivoyage request failed: could not parse response', err)
    return null
  }
}

// `action=parse` for a real article returns { parse: { title, wikitext: { '*': '...' } } }; a missing
// page returns { error: {...} } instead, so safeParse failing is our "no such country article" signal.
const WikitextResponseSchema = z.object({
  parse: z.object({
    title: z.string(),
    wikitext: z.object({ '*': z.string() }),
  }),
})

/** Full wikitext of a country's Wikivoyage article, or null if there's no article for it. */
async function fetchCountryWikitext(country: string): Promise<string | null> {
  const title = COUNTRY_ALIASES[country.trim().toLowerCase()] ?? country.trim()
  const data = await wikivoyageGet({ action: 'parse', page: title, prop: 'wikitext', redirects: '1' })
  if (!data) return null
  const parsed = WikitextResponseSchema.safeParse(data)
  if (!parsed.success) return null
  return parsed.data.parse.wikitext['*']
}

/**
 * Concatenate the bodies of the "Cities" and "Other destinations" level-2 sections — the two curated
 * (policy-capped, ~9-each) destination lists on every country article. Matched by substring, not
 * exact name, because the wording varies between articles ("Cities and towns", "Other destinations
 * and attractions", …); the numeric indices vary too (some countries lead with a "Regions" section).
 */
function isDestinationHeading(name: string): boolean {
  const n = name.trim().toLowerCase()
  return n.includes('cities') || n.includes('other destinations')
}

function extractDestinationSections(wikitext: string): string {
  const level2Heading = /^==([^=].*?)==\s*$/ // exactly two '=' each side → level-2 only
  const out: string[] = []
  let capturing = false

  for (const line of wikitext.split(/\r?\n/)) {
    const heading = line.trim().match(level2Heading)
    if (heading) {
      capturing = isDestinationHeading(heading[1])
      continue
    }
    if (capturing) out.push(line)
  }
  return out.join('\n')
}

/** Value of a single `key=value` field inside a `{{marker ...}}` template's parameter string. */
function markerField(fields: string, key: string): string | undefined {
  for (const part of fields.split('|')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim().toLowerCase() === key) return part.slice(eq + 1).trim()
  }
  return undefined
}

/** Page title from a marker's `name=` field, unwrapping `[[Target]]` / `[[Target|Display]]`. */
function markerTitle(fields: string): string | undefined {
  const raw = markerField(fields, 'name')
  if (!raw) return undefined
  const link = raw.match(/\[\[([^\]]+)\]\]/)
  const inner = link ? link[1] : raw
  const title = inner.split('|')[0].trim() // link target, not the display alias
  return title || undefined
}

interface RawDestination {
  name: string
  latitude: number
  longitude: number
}

/**
 * Pull every destination out of the Cities/Other-destinations wikitext. Each entry is a
 * `{{marker|type=city|name=[[X]]|lat=..|long=..}}` template that carries the coordinates inline, so
 * no separate geocoding call is needed. Entries missing a name or usable coords are dropped.
 */
function parseDestinations(sectionBody: string): RawDestination[] {
  const results: RawDestination[] = []
  const markerRe = /\{\{marker([^}]*)\}\}/gi
  let match: RegExpExecArray | null

  while ((match = markerRe.exec(sectionBody)) !== null) {
    const fields = match[1]
    const name = markerTitle(fields)
    const latitude = Number(markerField(fields, 'lat'))
    const longitude = Number(markerField(fields, 'long'))
    if (!name) continue
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue
    if (latitude === 0 && longitude === 0) continue // unset coords sometimes render as 0/0
    results.push({ name, latitude, longitude })
  }
  return results
}

// Enrichment: one batched query attaches an intro sentence to a set of page titles. Pages are keyed
// by pageid; missing pages come back with no extract, which the schema tolerates. (Images come from
// Pexels, not Wikivoyage — Wikivoyage's lead images are too often unhelpful for a destination card.)
const EnrichmentResponseSchema = z.object({
  query: z.object({
    pages: z.record(
      z.object({
        title: z.string(),
        extract: z.string().optional(),
      }),
    ),
  }),
})

/** Batched intro-sentence lookup, returned as a map of lowercased page title → description. */
async function fetchDescriptions(titles: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (titles.length === 0) return map

  const data = await wikivoyageGet({
    action: 'query',
    prop: 'extracts',
    exintro: '1',
    explaintext: '1',
    exsentences: '2',
    titles: titles.join('|'),
  })
  if (!data) return map

  const parsed = EnrichmentResponseSchema.safeParse(data)
  if (!parsed.success) {
    console.error('Wikivoyage enrichment: unexpected response shape', parsed.error)
    return map
  }
  for (const page of Object.values(parsed.data.query.pages)) {
    const extract = page.extract?.trim()
    if (extract) map.set(page.title.trim().toLowerCase(), extract)
  }
  return map
}

/** Options for {@link fetchSuggestions}. */
export interface FetchSuggestionsOptions {
  /** Names to skip (lowercased or not) — already-shown, dismissed, or saved destinations. */
  exclude?: Iterable<string>
  /** How many suggestions to return. Defaults to {@link DEFAULT_COUNT}. */
  count?: number
}

/**
 * Suggest new destinations to research, discovered from Wikivoyage's curated city lists for the
 * countries already on the user's bucket list. Strongest-signal countries (most saved locations)
 * are mined first. Never throws — any failure along the way yields fewer suggestions, or [].
 *
 * Pass `exclude` to top up an existing set without repeats (the tray does this on each refill) and
 * `count` to size the batch. Fewer than `count` results back means the source is drained.
 *
 * Images always come from Pexels (searched by bare place name — adding the country sharply cuts
 * Pexels results), else undefined so the card falls back to its placeholder. Wikivoyage lead images
 * are deliberately not used — they're too often unhelpful for a destination card.
 */
export async function fetchSuggestions(
  saved: Location[],
  options: FetchSuggestionsOptions = {},
): Promise<Suggestion[]> {
  if (saved.length === 0) return []

  const count = options.count ?? DEFAULT_COUNT
  const excluded = new Set<string>()
  for (const name of options.exclude ?? []) excluded.add(name.trim().toLowerCase())

  // Distinct countries, ordered by how many saved locations each has — the clearest taste signal.
  const countryCounts = new Map<string, number>()
  for (const loc of saved) {
    const country = loc.country.trim()
    if (country) countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1)
  }
  const countries = [...countryCounts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)

  // Never re-suggest something already on the list, nor anything the caller asked us to exclude.
  const savedNames = new Set(saved.map((l) => l.name.trim().toLowerCase()))

  const candidates: Array<RawDestination & { country: string }> = []
  const seen = new Set<string>()
  for (const country of countries) {
    if (candidates.length >= count) break
    const wikitext = await fetchCountryWikitext(country)
    if (!wikitext) continue
    for (const dest of parseDestinations(extractDestinationSections(wikitext))) {
      const key = dest.name.trim().toLowerCase()
      if (savedNames.has(key) || seen.has(key) || excluded.has(key)) continue
      seen.add(key)
      candidates.push({ ...dest, country })
    }
  }
  if (candidates.length === 0) return []

  const top = candidates.slice(0, count)
  const descriptions = await fetchDescriptions(top.map((d) => d.name))

  return Promise.all(
    top.map(async (dest): Promise<Suggestion> => {
      const pexels = await searchFirstPexelsPhoto(dest.name)
      return {
        name: dest.name,
        country: dest.country,
        latitude: dest.latitude,
        longitude: dest.longitude,
        description: descriptions.get(dest.name.trim().toLowerCase()),
        imageUrl: pexels?.url,
      }
    }),
  )
}
