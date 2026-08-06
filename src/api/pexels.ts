import { z } from 'zod'

const PEXELS_SEARCH_URL = 'https://api.pexels.com/v1/search'
const REQUEST_COUNT = 40
const MAX_RESULTS = 20

const PexelsPhotoSchema = z.object({
  id: z.number(),
  photographer: z.string(),
  alt: z.string().nullable().optional(),
  src: z.object({
    medium: z.string().url(),
  }),
})

const PexelsSearchResponseSchema = z.object({
  photos: z.array(PexelsPhotoSchema),
})

export interface PexelsPhoto {
  id: number
  url: string
  alt: string
}

/** Never throws — any failure (network, non-2xx, unexpected shape) logs to the console and resolves to []. */
export async function searchPexelsPhotos(query: string, perPage: number = REQUEST_COUNT): Promise<PexelsPhoto[]> {
  const apiKey = import.meta.env.VITE_PEXELS_API_KEY
  if (!apiKey) {
    console.error('Pexels image search skipped: VITE_PEXELS_API_KEY is not set.')
    return []
  }

  const url = `${PEXELS_SEARCH_URL}?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`

  let response: Response
  try {
    response = await fetch(url, { headers: { Authorization: apiKey } })
  } catch (err) {
    console.error('Pexels image search failed:', err)
    return []
  }

  if (!response.ok) {
    console.error(`Pexels image search failed: ${response.status} ${response.statusText}`)
    return []
  }

  let data: unknown
  try {
    data = await response.json()
  } catch (err) {
    console.error('Pexels image search failed: could not parse response', err)
    return []
  }

  const parsed = PexelsSearchResponseSchema.safeParse(data)
  if (!parsed.success) {
    console.error('Pexels image search failed: unexpected response shape', parsed.error)
    return []
  }

  return parsed.data.photos.slice(0, MAX_RESULTS).map((photo) => ({
    id: photo.id,
    url: photo.src.medium,
    alt: photo.alt || `Photo by ${photo.photographer}`,
  }))
}

/** Fetches a single representative photo for a query. Never throws — resolves to undefined on any failure. */
export async function searchFirstPexelsPhoto(query: string): Promise<PexelsPhoto | undefined> {
  const [first] = await searchPexelsPhotos(query, 1)
  return first
}
