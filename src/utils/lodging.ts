import type { TripItem } from '../types/trip'

// ISO date strings ('YYYY-MM-DD') compare correctly with plain string comparison, so no Date parsing.

export type StayBannerVariant = 'checkin' | 'checkout' | 'overnight' | 'wake'

export interface StayBanner {
  /** The lodging item, so a click can open its edit form. */
  item: TripItem
  variant: StayBannerVariant
  /** Relevant time for this banner: check-in time on the check-in day, check-out time on the check-out day. */
  time?: string
}

export interface DayStayBanners {
  /** Banners for the START of the day (you wake up here / check out today). Render above the day's stops. */
  top: StayBanner[]
  /** Banners for the END of the day (you check in today / sleep here). Render below the day's stops. */
  bottom: StayBanner[]
}

/** A stay's normalized span, or null when it isn't a datable lodging item (missing/invalid dates). */
function staySpan(item: TripItem): { start: string; end: string } | null {
  if (item.kind !== 'lodging') return null
  const { checkInDate: start, checkOutDate: end } = item
  if (!start || !end || end <= start) return null
  return { start, end }
}

/** True when the stay is anchored to at least one dated day, so it renders as banners rather than an "unplaced" card. */
export function isStayPlaced(item: TripItem, dayDates: Set<string>): boolean {
  const span = staySpan(item)
  if (!span) return false
  for (const date of dayDates) {
    if (date >= span.start && date <= span.end) return true
  }
  return false
}

/**
 * Banners for a single day, given every lodging stay on the trip. For a stay [start, end] and a day
 * date D:
 *  - you START the day at the hotel when start < D <= end (checked in earlier, not yet checked out) —
 *    a "wake" banner, or "checkout" on the last day;
 *  - you END the day at the hotel when start <= D < end — a "checkin" banner on arrival day, else
 *    "overnight".
 * A single-night stay yields just a check-in banner on night one and a check-out banner the next day.
 */
export function bannersForDay(dayDate: string | undefined, stays: TripItem[]): DayStayBanners {
  const result: DayStayBanners = { top: [], bottom: [] }
  if (!dayDate) return result

  for (const stay of stays) {
    const span = staySpan(stay)
    if (!span) continue
    const { start, end } = span

    if (dayDate > start && dayDate <= end) {
      const isCheckout = dayDate === end
      result.top.push({ item: stay, variant: isCheckout ? 'checkout' : 'wake', time: isCheckout ? stay.checkOutTime : undefined })
    }
    if (dayDate >= start && dayDate < end) {
      const isCheckin = dayDate === start
      result.bottom.push({ item: stay, variant: isCheckin ? 'checkin' : 'overnight', time: isCheckin ? stay.checkInTime : undefined })
    }
  }
  return result
}
