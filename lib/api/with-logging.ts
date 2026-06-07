import { NextResponse } from "next/server"
import { logError } from "@/lib/logger"

/**
 * Wraps a route handler so any uncaught exception is logged as structured JSON
 * (captured by Vercel runtime logs) and returned to the client as a generic 500.
 * All handler arguments are forwarded, so dynamic-segment context (e.g. the
 * `{ params }` object for `[profileId]` routes) is preserved.
 */
export function withRouteLogging<T extends unknown[]>(
  name: string,
  handler: (...args: T) => Promise<Response>
) {
  return async (...args: T): Promise<Response> => {
    try {
      return await handler(...args)
    } catch (error) {
      logError(`${name} failed`, error, { route: name })
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  }
}
