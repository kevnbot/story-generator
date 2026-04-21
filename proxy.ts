import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const PUBLIC_ROUTES = ["/login", "/signup", "/api/stripe/webhook", "/api/twilio/webhook"]
const ADMIN_ROUTES = ["/admin"]

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

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
  const { pathname } = request.nextUrl

  // Allow public routes and static files
  const isPublic = PUBLIC_ROUTES.some(r => pathname.startsWith(r))
  const isStatic = pathname.startsWith("/_next") || pathname.startsWith("/favicon")

  if (isStatic) return supabaseResponse

  // Redirect unauthenticated users to login
  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.searchParams.set("redirectTo", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from auth pages
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const homeUrl = request.nextUrl.clone()
    homeUrl.pathname = "/generate"
    return NextResponse.redirect(homeUrl)
  }

  // Guard admin routes
  if (pathname.startsWith("/admin") && user) {
    const adminIds = (process.env.ADMIN_USER_IDS || "").split(",").map(s => s.trim())
    if (!adminIds.includes(user.id)) {
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
