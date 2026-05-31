export interface ImageBytes {
  bytes: ArrayBuffer
  base64: string
  contentType: string
  extension: string
}

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
}

export function normalizeImageContentType(contentType: string | null, fallback = "image/webp"): string {
  if (!contentType) return fallback
  return contentType.split(";")[0].trim().toLowerCase()
}

export function contentTypeToExtension(contentType: string): string {
  return MIME_EXTENSION_MAP[contentType] ?? "webp"
}

export function hasImageContentType(contentType: string): boolean {
  return contentType.startsWith("image/")
}

export function arrayBufferToBase64(bytes: ArrayBuffer): string {
  return Buffer.from(new Uint8Array(bytes)).toString("base64")
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const bytes = Uint8Array.from(Buffer.from(base64, "base64"))
  return bytes.buffer
}

export function dataUriFromBase64(base64: string, contentType: string): string {
  return `data:${contentType};base64,${base64}`
}

export function parseImageDataUri(sourceUrl: string): ImageBytes | null {
  const match = sourceUrl.match(/^data:([^;,]+);base64,(.+)$/i)
  if (!match) return null

  const contentType = normalizeImageContentType(match[1])
  if (!hasImageContentType(contentType)) return null

  const bytes = base64ToArrayBuffer(match[2])
  return {
    bytes,
    base64: match[2],
    contentType,
    extension: contentTypeToExtension(contentType),
  }
}

export function estimateBase64Bytes(base64: string): number {
  return Math.floor(base64.replace(/=+$/, "").length * 0.75)
}

export function estimateDataUriBytes(dataUri: string): number {
  const base64 = dataUri.split(",")[1] ?? ""
  return estimateBase64Bytes(base64)
}

export async function readImageUrl(sourceUrl: string): Promise<ImageBytes> {
  const dataUriImage = parseImageDataUri(sourceUrl)
  if (dataUriImage) return dataUriImage

  const response = await fetch(sourceUrl)
  if (!response.ok) {
    throw new Error(`failed to fetch image: status ${response.status}`)
  }

  const contentType = normalizeImageContentType(response.headers.get("content-type"))
  if (!hasImageContentType(contentType)) {
    throw new Error(`invalid content type: ${contentType}`)
  }

  const bytes = await response.arrayBuffer()
  if (bytes.byteLength === 0) {
    throw new Error("empty image response")
  }

  return {
    bytes,
    base64: arrayBufferToBase64(bytes),
    contentType,
    extension: contentTypeToExtension(contentType),
  }
}
