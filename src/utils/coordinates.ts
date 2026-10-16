// One decimal coordinate with an optional degree sign and N/S/E/W hemisphere letter, e.g. "48.8584° N".
const COORD = String.raw`([-+]?\d+(?:\.\d+)?)\s*°?\s*([NSEW])?`
// Two coordinates separated by a comma, semicolon or whitespace, optionally wrapped in parentheses.
const PAIR_PATTERN = new RegExp(String.raw`^\s*\(?\s*${COORD}\s*[,;\s]\s*${COORD}\s*\)?\s*$`, 'i')

/**
 * Parses a pasted "lat, lon" pair — e.g. "48.8584, 2.2945" (Google Maps' right-click copy),
 * "48.8584 2.2945" or "48.8584° N, 2.2945° E". Returns null for anything else (including
 * out-of-range values or mismatched hemisphere letters), so the caller can let the paste through unchanged.
 */
export function parseCoordinatePair(text: string): { latitude: number; longitude: number } | null {
  const match = PAIR_PATTERN.exec(text)
  if (!match) return null
  const [, latRaw, latHemi, lonRaw, lonHemi] = match
  const latLetter = latHemi?.toUpperCase()
  const lonLetter = lonHemi?.toUpperCase()
  if ((latLetter && latLetter !== 'N' && latLetter !== 'S') || (lonLetter && lonLetter !== 'E' && lonLetter !== 'W')) {
    return null
  }

  let latitude = Number(latRaw)
  let longitude = Number(lonRaw)
  if (latLetter) latitude = latLetter === 'S' ? -Math.abs(latitude) : Math.abs(latitude)
  if (lonLetter) longitude = lonLetter === 'W' ? -Math.abs(longitude) : Math.abs(longitude)

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  return { latitude, longitude }
}
