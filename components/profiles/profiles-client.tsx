"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { ProfileForm } from "./profile-form"
import { deleteProfile } from "@/app/actions/profiles"
import { formatAge } from "@/lib/ai/prompt-builder"

interface Profile {
  id: string
  name: string
  age: number
  age_months: number
  gender?: string
  appearance: { hair?: string; hair_color?: string; eye_color?: string }
  personality_tags: string[]
  toy: { name: string; description?: string; type?: string }
}

export function ProfilesClient({ profiles }: { profiles: Profile[] }) {
  const [showForm, setShowForm] = useState(profiles.length === 0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const handleDelete = (id: string) => {
    startTransition(async () => { await deleteProfile(id) })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kid Profiles</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Each profile personalizes stories for that child.
          </p>
        </div>
        {profiles.length > 0 && !showForm && !editingId && (
          <Button onClick={() => setShowForm(true)} size="sm">
            Add Profile
          </Button>
        )}
      </div>

      {profiles.length > 0 && (
        <div className="grid gap-3">
          {profiles.map(profile => (
            <div key={profile.id}>
              {editingId === profile.id ? (
                <div className="rounded-xl border p-6 bg-card">
                  <h2 className="font-semibold mb-4">Edit {profile.name}</h2>
                  <ProfileForm
                    profile={profile}
                    onSuccess={() => setEditingId(null)}
                  />
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="mt-3 text-sm text-muted-foreground hover:text-foreground w-full text-center"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 rounded-xl border bg-card">
                  <div>
                    <div className="font-medium">
                      {profile.name}, {formatAge(profile.age, profile.age_months ?? 0)}
                      {profile.gender ? <span className="ml-1 text-muted-foreground font-normal">· {profile.gender}</span> : null}
                    </div>
                    {profile.toy?.name && profile.toy.name !== "their favorite toy" && (
                      <div className="text-sm text-muted-foreground">
                        Toy: {profile.toy.name}
                        {(profile.toy.description || profile.toy.type)
                          ? ` — ${profile.toy.description ?? profile.toy.type}`
                          : ""}
                      </div>
                    )}
                    {profile.personality_tags.length > 0 && (
                      <div className="text-sm text-muted-foreground mt-0.5">
                        {profile.personality_tags[0]}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setShowForm(false); setEditingId(profile.id) }}
                      disabled={pending}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(profile.id)}
                      disabled={pending}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="rounded-xl border p-6 bg-card">
          <h2 className="font-semibold mb-4">
            {profiles.length === 0 ? "Add your first profile" : "New profile"}
          </h2>
          <ProfileForm onSuccess={() => setShowForm(false)} />
          {profiles.length > 0 && (
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="mt-3 text-sm text-muted-foreground hover:text-foreground w-full text-center"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {profiles.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center min-h-[30vh] text-center gap-4">
          <div className="text-5xl">👧</div>
          <p className="text-muted-foreground">No profiles yet. Add one to get started.</p>
          <Button onClick={() => setShowForm(true)}>Add Profile</Button>
        </div>
      )}
    </div>
  )
}
