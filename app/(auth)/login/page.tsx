import { LoginForm } from "@/components/auth/login-form"

const errorMessages: Record<string, string> = {
  confirmation_failed: "We could not confirm that link. Please sign in or request a new link.",
}

const successMessages: Record<string, string> = {
  password_updated: "Your password has been updated. Sign in with your new password.",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string; message?: string }>
}) {
  const { redirectTo, error, message } = await searchParams
  return (
    <LoginForm
      redirectTo={redirectTo}
      initialError={error ? errorMessages[error] : undefined}
      message={message ? successMessages[message] : undefined}
    />
  )
}
