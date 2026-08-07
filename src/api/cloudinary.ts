import imageCompression from 'browser-image-compression'

const MAX_INPUT_BYTES = 25 * 1024 * 1024

const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1600,
  useWebWorker: true,
}

export class CloudinaryUploadError extends Error {}

/**
 * Compresses an image client-side (resizes to a max dimension and re-encodes), then uploads it
 * to Cloudinary via an unsigned upload preset — no backend involved, same pattern as the Pexels
 * calls. Unlike Pexels' fail-silent helpers, this throws: the user explicitly chose to upload a
 * file, so a failure needs to reach them, not disappear into the console.
 */
export async function uploadImage(file: File): Promise<string> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
  if (!cloudName || !uploadPreset) {
    throw new CloudinaryUploadError(
      'Image upload is not configured. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.',
    )
  }

  if (file.size > MAX_INPUT_BYTES) {
    throw new CloudinaryUploadError('That image is too large — please choose a file under 25MB.')
  }

  let compressed: File | Blob
  try {
    compressed = await imageCompression(file, COMPRESSION_OPTIONS)
  } catch (err) {
    throw new CloudinaryUploadError(
      err instanceof Error ? `Could not process that image: ${err.message}` : 'Could not process that image.',
    )
  }

  const formData = new FormData()
  formData.append('file', compressed, file.name)
  formData.append('upload_preset', uploadPreset)

  let response: Response
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
    })
  } catch {
    throw new CloudinaryUploadError('Could not reach the image host. Check your connection.')
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new CloudinaryUploadError(
      typeof data?.error?.message === 'string' ? data.error.message : 'Image upload failed.',
    )
  }
  if (typeof data?.secure_url !== 'string') {
    throw new CloudinaryUploadError('Unexpected response from the image host.')
  }

  return data.secure_url as string
}
