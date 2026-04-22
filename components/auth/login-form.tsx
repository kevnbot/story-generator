"use client"

import { useActionState } from "react"
import Link from "next/link"
import { login } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [error, action, pending] = useActionState(login, null)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-border p-8">
      <h2 className="text-xl font-semibold mb-6">Sign in</h2>
      <form action={action} className="space-y-4">
        <input type="hidden" name="redirectTo" value={redirectTo || "/generate"} />
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="you@example.com" required autoComplete="email" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" placeholder="••••••••" required autoComplete="current-password" />
        </div>
        {error && (
          <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="text-sm text-center text-muted-foreground mt-6">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-brand-600 font-medium hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  )
}
