import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// Only init if env vars present (graceful local dev without Redis)
function createRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
}

const redis = createRedis()

// Story generation: 10 per hour per user
const storyLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 h"), prefix: "rl:story" })
  : null

// SMS sends: 20 per hour per user (prevent abuse)
const smsLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, "1 h"), prefix: "rl:sms" })
  : null

export async function checkStoryRateLimit(userId: string) {
  if (!storyLimiter) return { allowed: true, remaining: 999 }
  const { success, remaining } = await storyLimiter.limit(userId)
  return { allowed: success, remaining }
}

export async function checkSmsRateLimit(userId: string) {
  if (!smsLimiter) return { allowed: true, remaining: 999 }
  const { success, remaining } = await smsLimiter.limit(userId)
  return { allowed: success, remaining }
}
