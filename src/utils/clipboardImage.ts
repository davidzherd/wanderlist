// Shared by the photo fields that accept pasted images (AddLocationPopup, the trip's custom-stop form).

/** A failed clipboard read, with a message that's safe to show the user as-is. */
export class ClipboardImageError extends Error {}

/**
 * Reads the first image off the clipboard via the async Clipboard API (needs a user gesture, e.g. a button click).
 * Throws ClipboardImageError when the browser can't, the user blocks it, or there's no image on the clipboard.
 */
export async function readClipboardImage(): Promise<File> {
  if (!navigator.clipboard?.read) {
    throw new ClipboardImageError('Your browser doesn’t support pasting from the clipboard here.')
  }
  let items: ClipboardItems
  try {
    items = await navigator.clipboard.read()
  } catch {
    throw new ClipboardImageError('Couldn’t read your clipboard. Check browser permissions and try again.')
  }
  for (const item of items) {
    const imageType = item.types.find((type) => type.startsWith('image/'))
    if (imageType) {
      const blob = await item.getType(imageType)
      const ext = blob.type.split('/')[1] || 'png'
      return new File([blob], `pasted-${Date.now()}.${ext}`, { type: blob.type })
    }
  }
  throw new ClipboardImageError('No image found in your clipboard. Copy an image, then try again.')
}

/** The first image in a Ctrl/⌘+V paste event, if any (no permission needed — the paste itself is the consent). */
export function imageFromPasteEvent(clipboardData: DataTransfer): File | null {
  return (
    Array.from(clipboardData.items)
      .find((item) => item.type.startsWith('image/'))
      ?.getAsFile() ?? null
  )
}

export function isValidImageUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
