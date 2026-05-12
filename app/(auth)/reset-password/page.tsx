import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { PasswordUpdateForm } from "@/components/auth/password-update-form"

export default async function ResetPasswordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="bg-white rounded-2xl shadow-xs border border-border p-8 text-center">
        <h2 className="text-xl font-semibold mb-2">Reset link expired</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Request a new password reset link to continue.
        </p>
        <Button asChild className="w-full">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-border p-8">
      <h2 className="text-xl font-semibold mb-2">Create a new password</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Choose a new password for your account.
      </p>
      <PasswordUpdateForm flow="recovery" submitLabel="Update password" />
    </div>
  )
}
