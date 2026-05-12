import type { MetadataRoute } from "next"

function getBaseUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  return appUrl.replace(/\/+$/, "")
}

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl()

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/generate", "/profiles", "/library", "/stories", "/admin", "/api"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
