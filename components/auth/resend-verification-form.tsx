"use client"

import { useActionState } from "react"
import { resendVerificationEmail } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ResendVerificationForm() {
  const [state, action, pending] = useActionState(resendVerificationEmail, null)

  return (
    <form action={action} className="space-y-4 text-left">
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
      <Button type="submit" variant="outline" className="w-full" disabled={pending}>
        {pending ? "Sending..." : "Resend confirmation"}
      </Button>
    </form>
  )
}
