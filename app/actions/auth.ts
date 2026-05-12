"use server"

import { redirect } from "next/navigation"
import { sanitizeInternalRedirect } from "@/lib/auth/redirects"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { config } from "@/lib/config"

export type AuthFormState = {
  error?: string
  message?: string
  status?: "success"
} | null

const GENERIC_RESET_MESSAGE =
  "If an account exists for that email, we sent password reset instructions."
const GENERIC_VERIFY_MESSAGE =
  "If that email is waiting for verification, we sent a new confirmation link."

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "")
}

export async function login(
  prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const redirectTo = sanitizeInternalRedirect(formData.get("redirectTo"), "/generate")

  if (!email || !password) return "Email and password are required."

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return error.message

  redirect(redirectTo)
}

export async function signup(
  prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const name = (formData.get("name") as string)?.trim()
  const email = (formData.get("email") as string)?.trim()
  const password = formData.get("password") as string

  if (!name || !email || !password) return "All fields are required."
  if (password.length < 8) return "Password must be at least 8 characters."

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${appUrl()}/api/auth/callback`,
    },
  })

  if (error) return error.message
  if (!data.user) return "Signup failed. Please try again."

  const service = createServiceClient()

  const { data: account, error: accountErr } = await service
    .from("accounts")
    .insert({ name: "My Family", credit_balance: 0 })
    .select("id")
    .single()

  if (accountErr || !account) return "Failed to create account."

  const { error: userErr } = await service.from("users").insert({
    id: data.user.id,
    account_id: account.id,
    email,
    display_name: name,
  })

  if (userErr) return "Failed to create user profile."

  await service
    .from("notification_preferences")
    .insert({ user_id: data.user.id })

  const freeCredits = await config.freeTierCredits()

  await service
    .from("accounts")
    .update({ credit_balance: freeCredits })
    .eq("id", account.id)

  await service.from("credit_transactions").insert({
    account_id: account.id,
    user_id: data.user.id,
    amount: freeCredits,
    type: "promo",
    description: "Welcome credits",
  })

  // If Supabase auto-confirmed the session, go straight to the app
  if (data.session) redirect("/generate")

  // Otherwise they need to verify their email
  redirect("/verify-email")
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

export async function requestPasswordReset(
  prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = (formData.get("email") as string)?.trim()

  if (!email) return { error: "Email is required." }

  const supabase = await createClient()
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl()}/api/auth/callback?next=/reset-password`,
  })

  return {
    status: "success",
    message: GENERIC_RESET_MESSAGE,
  }
}

export async function resendVerificationEmail(
  prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = (formData.get("email") as string)?.trim()

  if (!email) return { error: "Email is required." }

  const supabase = await createClient()
  await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${appUrl()}/api/auth/callback`,
    },
  })

  return {
    status: "success",
    message: GENERIC_VERIFY_MESSAGE,
  }
}

export async function updatePassword(
  prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const password = formData.get("password") as string
  const confirmPassword = formData.get("confirmPassword") as string
  const flow = formData.get("flow") === "recovery" ? "recovery" : "account"

  if (!password || !confirmPassword) return { error: "Password and confirmation are required." }
  if (password.length < 8) return { error: "Password must be at least 8 characters." }
  if (password !== confirmPassword) return { error: "Passwords do not match." }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    if (flow === "recovery") redirect("/forgot-password?error=expired")
    return { error: "You need to be signed in to update your password." }
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }

  if (flow === "recovery") {
    await supabase.auth.signOut()
    redirect("/login?message=password_updated")
  }

  redirect("/account/security?message=password_updated")
}
