import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function VerifyEmailPage() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-border p-8 text-center">
      <div className="text-4xl mb-4">📬</div>
      <h2 className="text-xl font-semibold mb-2">Check your email</h2>
      <p className="text-sm text-muted-foreground mb-6">
        We sent a confirmation link to your email address. Click it to activate your account.
      </p>
      <Button asChild variant="outline" className="w-full">
        <Link href="/login">Back to sign in</Link>
      </Button>
    </div>
  )
}
