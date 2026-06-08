import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { sanitizeInternalRedirect } from "@/lib/auth/redirects"
import { isPlatformAdmin } from "@/lib/auth/platform-admin"

const PUBLIC_ROUTES = [
  "/login",
  "/signup",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/share/",
  "/api/auth/callback",
  "/api/stripe/webhook",
  "/api/twilio/webhook",
]
const PUBLIC_METADATA_ROUTES = ["/sitemap.xml", "/robots.txt"]
// Exact-match public routes — used for paths like "/" that can't be matched
// with startsWith (it would match every route).
const PUBLIC_EXACT_ROUTES = ["/", "/terms", "/privacy"]
const ADMIN_ROUTES = ["/admin"]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic =
    PUBLIC_ROUTES.some(r => pathname.startsWith(r)) || PUBLIC_EXACT_ROUTES.includes(pathname)
  const isPublicMetadata = PUBLIC_METADATA_ROUTES.includes(pathname)
  // Treat framework internals and public static asset files as static so they're
  // never gated by auth (e.g. /images/*.png served to logged-out marketing visitors,
  // including via the next/image optimizer's internal fetch of the source file).
  const isStatic =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.(png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|mp4|webm)$/i.test(pathname)
  const isServerAction = request.headers.has("next-action")

  if (isStatic || isPublicMetadata) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  if (process.env.NEXT_PUBLIC_E2E_TEST === "true") {
    if (pathname.startsWith("/test-harness") || isPublic) return supabaseResponse
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.searchParams.set("redirectTo", sanitizeInternalRedirect(pathname))
    return NextResponse.redirect(loginUrl)
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users to login
  if (!user && !isPublic) {
    if (isServerAction) return supabaseResponse

    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.searchParams.set("redirectTo", sanitizeInternalRedirect(pathname))
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from the marketing home and auth pages
  if (user && (pathname === "/" || pathname === "/login" || pathname === "/signup")) {
    const homeUrl = request.nextUrl.clone()
    homeUrl.pathname = "/generate"
    return NextResponse.redirect(homeUrl)
  }

  // Guard admin routes
  if (ADMIN_ROUTES.some(r => pathname.startsWith(r)) && user) {
    const hasAdminAccess = await isPlatformAdmin(user.id)
    if (!hasAdminAccess) {
      const homeUrl = request.nextUrl.clone()
      homeUrl.pathname = "/generate"
      return NextResponse.redirect(homeUrl)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
