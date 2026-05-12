import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"

const errorMessages: Record<string, string> = {
  expired: "That reset link is invalid or expired. Request a new one to continue.",
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return <ForgotPasswordForm initialError={error ? errorMessages[error] : undefined} />
}
