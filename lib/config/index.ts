import { createServiceClient } from "@/lib/supabase/server"

// In-memory cache with TTL to avoid hammering DB on every request
const cache = new Map<string, { value: string; expires: number }>()
const CACHE_TTL_MS = 60_000 // 1 minute

async function getConfig(key: string, fallback: string): Promise<string> {
  const now = Date.now()
  const cached = cache.get(key)
  if (cached && cached.expires > now) return cached.value

  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", key)
      .single()

    const value = data?.value ?? fallback
    cache.set(key, { value, expires: now + CACHE_TTL_MS })
    return value
  } catch {
    return fallback
  }
}

export const config = {
  creditsPerStory: () => getConfig("credits_per_story", "1").then(Number),
  freeTierCredits: () => getConfig("free_tier_credits", "30").then(Number),
  lowCreditsThreshold: () => getConfig("low_credits_threshold", "5").then(Number),
  maxFamilyMembers: () => getConfig("max_family_members", "5").then(Number),
  smsEnabled: () => getConfig("sms_enabled", "true").then(v => v === "true"),
  maintenanceMode: () => getConfig("maintenance_mode", "false").then(v => v === "true"),
}
