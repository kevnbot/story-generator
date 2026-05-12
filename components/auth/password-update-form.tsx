"use client"

import { useActionState } from "react"
import { updatePassword } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function PasswordUpdateForm({
  flow,
  submitLabel,
}: {
  flow: "account" | "recovery"
  submitLabel: string
}) {
  const [state, action, pending] = useActionState(updatePassword, null)

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="flow" value={flow} />
      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="At least 8 characters"
          required
          autoComplete="new-password"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          placeholder="Repeat your new password"
          required
          autoComplete="new-password"
        />
      </div>
      {state?.error && (
        <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Updating..." : submitLabel}
      </Button>
    </form>
  )
}
