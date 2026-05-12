export function sanitizeInternalRedirect(
  value: FormDataEntryValue | string | null | undefined,
  fallback = "/generate"
) {
  if (typeof value !== "string") return fallback

  const trimmed = value.trim()
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return fallback
  }

  try {
    const url = new URL(trimmed, "https://app.local")
    if (url.origin !== "https://app.local") return fallback
    return `${url.pathname}${url.search}${url.hash}` || fallback
  } catch {
    return fallback
  }
}
