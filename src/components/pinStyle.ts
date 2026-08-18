// Shared styling data for map pins: the color palette shown in the picker, the curated
// travel-emoji set, the curated Lucide icon set (a more conservative alternative to emoji),
// the default pin color (matches the legacy brass pin), and helpers used by both the edit
// form (AddLocationPopup) and the marker renderer (CustomClusterIcon).

import type { LucideIcon } from 'lucide-react'
import {
  Plane, PersonStanding, Mountain, TreePalm, Tent, Ship, Sailboat, Car, Bus, TrainFront,
  Hotel, Camera, Utensils, Wine, Coffee, Landmark, House, FerrisWheel, DollarSign, Umbrella,
} from 'lucide-react'

// The gold/brass every pin used before per-pin colors existed. Locations with no saved color
// fall back to this, so existing pins look identical until the user picks something.
export const DEFAULT_PIN_COLOR = '#C79A3D'

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100
  const lig = l / 100
  const a = sat * Math.min(lig, 1 - lig)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = lig - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

// A 10-column grid: a grayscale row (white → black) on top, then 6 shade rows sweeping the
// full hue wheel across the columns. 70 swatches total — within the requested 10×10 ceiling.
const HUE_STEPS = 10
const SHADES: { s: number; l: number }[] = [
  { s: 78, l: 84 },
  { s: 80, l: 71 },
  { s: 82, l: 58 },
  { s: 82, l: 47 },
  { s: 80, l: 37 },
  { s: 76, l: 27 },
]

const GRAYSCALE_ROW: string[] = Array.from({ length: HUE_STEPS }, (_, i) => {
  // Even lightness ramp from near-white to near-black across the 10 columns.
  const l = Math.round(96 - (i * 92) / (HUE_STEPS - 1))
  return hslToHex(0, 0, l)
})

const HUE_ROWS: string[] = SHADES.flatMap(({ s, l }) =>
  Array.from({ length: HUE_STEPS }, (_, col) => hslToHex((col * 360) / HUE_STEPS, s, l)),
)

export const PIN_COLORS: string[] = [...GRAYSCALE_ROW, ...HUE_ROWS]

// 50 most common travel emojis: places, landmarks, sights, food, transport, lodging, wildlife.
export const TRAVEL_EMOJIS: string[] = [
  '🏖️', '🏝️', '🏔️', '⛰️', '🌋', '🗻', '🏕️', '⛺', '🏜️', '🏞️',
  '🌅', '🌄', '🗺️', '🧭', '🏛️', '🏰', '🕌', '⛩️', '🗼', '🗽',
  '⛲', '🎡', '🎢', '🎠', '🎪', '🎭', '🖼️', '🏟️', '🎨', '🍜',
  '🍣', '🍕', '🍷', '🍺', '☕', '🍹', '🚗', '🚕', '🚌', '🚆',
  '✈️', '🚢', '⛵', '🚁', '🏨', '⛱️', '🐘', '🐠', '🐳', '🦁',
]

// Curated Lucide icons for pins that prefer a clean line symbol over an emoji. The `name` is
// the stable id stored in the DB (locations.icon); the marker renderer and the picker both
// resolve it back to a component through TRAVEL_ICON_MAP, so a pin re-renders correctly on load.
export const TRAVEL_ICONS: { name: string; Icon: LucideIcon }[] = [
  { name: 'plane', Icon: Plane },
  { name: 'hiker', Icon: PersonStanding },
  { name: 'mountain', Icon: Mountain },
  { name: 'palm', Icon: TreePalm },
  { name: 'tent', Icon: Tent },
  { name: 'ship', Icon: Ship },
  { name: 'sailboat', Icon: Sailboat },
  { name: 'car', Icon: Car },
  { name: 'bus', Icon: Bus },
  { name: 'train', Icon: TrainFront },
  { name: 'hotel', Icon: Hotel },
  { name: 'camera', Icon: Camera },
  { name: 'food', Icon: Utensils },
  { name: 'wine', Icon: Wine },
  { name: 'coffee', Icon: Coffee },
  { name: 'landmark', Icon: Landmark },
  { name: 'house', Icon: House },
  { name: 'attraction', Icon: FerrisWheel },
  { name: 'dollar', Icon: DollarSign },
  { name: 'umbrella', Icon: Umbrella },
]

export const TRAVEL_ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  TRAVEL_ICONS.map(({ name, Icon }) => [name, Icon]),
)

// Pick a readable dot/foreground color for a given pin background using relative luminance,
// so the fallback dot (shown when a pin has no emoji) stays visible on both light and dark pins.
export function getPinContrastColor(hex: string): string {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return '#ffffff'
  const r = parseInt(normalized.slice(0, 2), 16) / 255
  const g = parseInt(normalized.slice(2, 4), 16) / 255
  const b = parseInt(normalized.slice(4, 6), 16) / 255
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
  return luminance > 0.55 ? '#1f2937' : '#ffffff'
}
