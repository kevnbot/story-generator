import type { MetadataRoute } from "next"

function getBaseUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  return appUrl.replace(/\/+$/, "")
}

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: getBaseUrl(),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ]
}
