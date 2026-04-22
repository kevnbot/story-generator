"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { ProfileForm } from "./profile-form"
import { deleteProfile } from "@/app/actions/profiles"

interface Profile {
  id: string
  name: string
  age: number
  personality_tags: string[]
  toy: { name: string; type?: string }
}

export function ProfilesClient({ profiles }: { profiles: Profile[] }) {
  const [showForm, setShowForm] = useState(profiles.length === 0)
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
        {profiles.length > 0 && !showForm && (
          <Button onClick={() => setShowForm(true)} size="sm">
            Add Profile
          </Button>
        )}
      </div>

      {profiles.length > 0 && (
        <div className="grid gap-3">
          {profiles.map(profile => (
            <div
              key={profile.id}
              className="flex items-center justify-between p-4 rounded-xl border bg-card"
            >
              <div>
                <div className="font-medium">{profile.name}, age {profile.age}</div>
                {profile.toy?.name && (
                  <div className="text-sm text-muted-foreground">
                    Toy: {profile.toy.name}{profile.toy.type ? ` (${profile.toy.type})` : ""}
                  </div>
                )}
                {profile.personality_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {profile.personality_tags.map(tag => (
                      <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(profile.id)}
                disabled={pending}
                className="text-muted-foreground hover:text-destructive shrink-0"
              >
                Remove
              </Button>
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
