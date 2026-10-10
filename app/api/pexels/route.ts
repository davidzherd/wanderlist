import type { NextRequest } from 'next/server'

const PEXELS_SEARCH_URL = 'https://api.pexels.com/v1/search'

// Server-side proxy so the Pexels key never ships in the client bundle. The client (src/api/pexels.ts)
// still validates the response shape and fails closed on any non-2xx from here.
export async function GET(request: NextRequest) {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'PEXELS_API_KEY is not set' }, { status: 500 })
  }

  const query = request.nextUrl.searchParams.get('query')?.trim()
  if (!query) {
    return Response.json({ error: 'Missing query' }, { status: 400 })
  }
  const perPage = Math.min(Math.max(Number(request.nextUrl.searchParams.get('per_page')) || 1, 1), 80)

  try {
    const res = await fetch(`${PEXELS_SEARCH_URL}?query=${encodeURIComponent(query)}&per_page=${perPage}`, {
      headers: { Authorization: apiKey },
    })
    return new Response(res.body, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
    })
  } catch {
    return Response.json({ error: 'Pexels request failed' }, { status: 502 })
  }
}
