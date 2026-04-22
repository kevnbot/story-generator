"use server"

import { redirect } from "next/navigation"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { config } from "@/lib/config"

export async function login(
  prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const redirectTo = (formData.get("redirectTo") as string) || "/generate"

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
  const { data, error } = await supabase.auth.signUp({ email, password })

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
