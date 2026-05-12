"use client"

import { useActionState } from "react"
import Link from "next/link"
import { requestPasswordReset, type AuthFormState } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ForgotPasswordForm({ initialError }: { initialError?: string }) {
  const initialState: AuthFormState = initialError ? { error: initialError } : null
  const [state, action, pending] = useActionState(requestPasswordReset, initialState)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-border p-8">
      <h2 className="text-xl font-semibold mb-2">Reset your password</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Enter your email and we&apos;ll send a link to create a new password.
      </p>
      <form action={action} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="you@example.com" required autoComplete="email" />
        </div>
        {state?.error && (
          <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
            {state.error}
          </p>
        )}
        {state?.message && (
          <p className="text-sm text-brand-700 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2">
            {state.message}
          </p>
        )}
        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending ? "Sending link..." : "Send reset link"}
        </Button>
      </form>
      <p className="text-sm text-center text-muted-foreground mt-6">
        Remember your password?{" "}
        <Link href="/login" className="text-brand-600 font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
