type LogContext = Record<string, unknown>

type LogLevel = "debug" | "info" | "warn" | "error"

function emit(level: LogLevel, message: string, context?: LogContext) {
  const line = JSON.stringify({ level, message, time: new Date().toISOString(), ...context })
  if (level === "error") console.error(line)
  else if (level === "warn") console.warn(line)
  else console.log(line)
}

export const logger = {
  debug: (message: string, context?: LogContext) => emit("debug", message, context),
  info: (message: string, context?: LogContext) => emit("info", message, context),
  warn: (message: string, context?: LogContext) => emit("warn", message, context),
  error: (message: string, context?: LogContext) => emit("error", message, context),
}

function serializeError(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message, stack: error.stack }
  return { value: String(error) }
}

export function logError(message: string, error: unknown, context?: LogContext) {
  logger.error(message, { ...context, error: serializeError(error) })
}
