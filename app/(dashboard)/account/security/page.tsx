import { PasswordUpdateForm } from "@/components/auth/password-update-form"

const successMessages: Record<string, string> = {
  password_updated: "Your password has been updated.",
}

export default async function AccountSecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const { message } = await searchParams
  const successMessage = message ? successMessages[message] : null

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-2">Account security</h1>
      <p className="text-muted-foreground mb-6">
        Update the password you use to sign in.
      </p>
      <div className="bg-white rounded-2xl shadow-sm border border-border p-6">
        {successMessage && (
          <p className="text-sm text-brand-700 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2 mb-4">
            {successMessage}
          </p>
        )}
        <PasswordUpdateForm flow="account" submitLabel="Save password" />
      </div>
    </div>
  )
}
