import { createServiceRoleClient } from "@/lib/supabase/service"

function parseFallbackAdminIds() {
  return (process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean)
}

function isFallbackAdmin(userId: string) {
  return parseFallbackAdminIds().includes(userId)
}

export async function isPlatformAdmin(userId: string) {
  if (!userId) return false

  const service = createServiceRoleClient()
  const { data, error } = await service
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle()

  if (error) {
    // Keep env-based allowlist as migration-safe fallback.
    return isFallbackAdmin(userId)
  }

  return Boolean(data) || isFallbackAdmin(userId)
}

export async function assertPlatformAdmin(userId: string) {
  if (!(await isPlatformAdmin(userId))) {
    throw new Error("FORBIDDEN_PLATFORM_ADMIN")
  }
}
