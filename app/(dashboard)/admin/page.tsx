import { createClient, createServiceClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Story } from "@/types"
import PromptViewer from "@/components/admin/PromptViewer"

export const metadata = {
  title: "Prompt Log | Admin",
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const service = createServiceClient()

  const { data: userRow } = await service
    .from("users")
    .select("account_id")
    .eq("id", user.id)
    .single()

  const { data: stories } = userRow
    ? await service
        .from("stories")
        .select("id, title, has_images, created_at, generation_params")
        .eq("account_id", userRow.account_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-foreground">Prompt Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generation prompts for the {stories?.length ?? 0} most recent stories. Expand a row to see all prompts sent.
        </p>
      </div>

      <PromptViewer stories={(stories ?? []) as Story[]} />
    </div>
  )
}
