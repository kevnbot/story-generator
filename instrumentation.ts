import type { Instrumentation } from "next"
import { logError } from "@/lib/logger"

export const onRequestError: Instrumentation.onRequestError = (err, request, context) => {
  logError("request error", err, {
    path: request.path,
    method: request.method,
    routeType: context.routeType,
  })
}
