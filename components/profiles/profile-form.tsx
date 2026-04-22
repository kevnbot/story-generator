"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createProfile, updateProfile } from "@/app/actions/profiles"

interface EditProfile {
  id: string
  name: string
  age: number
  age_months: number
  gender?: string
  appearance: { hair?: string; hair_color?: string; eye_color?: string }
  personality_tags: string[]
  toy: { name: string; description?: string; type?: string }
}

interface ProfileFormProps {
  onSuccess?: () => void
  profile?: EditProfile
}

export function ProfileForm({ onSuccess, profile }: ProfileFormProps) {
  const action = profile ? updateProfile.bind(null, profile.id) : createProfile

  const [error, formAction, pending] = useActionState(
    async (prev: string | null, formData: FormData) => {
      const result = await action(prev, formData)
      if (!result && onSuccess) onSuccess()
      return result
    },
    null
  )

  const toyName = profile?.toy?.name === "their favorite toy" ? "" : (profile?.toy?.name ?? "")
  const toyDesc = profile?.toy?.description ?? profile?.toy?.type ?? ""
  const hair = profile?.appearance?.hair ?? profile?.appearance?.hair_color ?? ""
  const personality = profile?.personality_tags?.[0] ?? ""

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-1 space-y-1.5">
          <Label htmlFor="name">Child's name</Label>
          <Input id="name" name="name" placeholder="Emma" required defaultValue={profile?.name} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="age">Years</Label>
          <Input id="age" name="age" type="number" min="0" max="17" placeholder="0" defaultValue={profile?.age ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="age_months">Months</Label>
          <Input id="age_months" name="age_months" type="number" min="0" max="11" placeholder="0" defaultValue={profile?.age_months ?? ""} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="gender">Gender</Label>
          <select
            id="gender"
            name="gender"
            defaultValue={profile?.gender ?? ""}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Not specified</option>
            <option value="girl">Girl</option>
            <option value="boy">Boy</option>
            <option value="non-binary">Non-binary</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="eye_color">Eye color</Label>
          <Input id="eye_color" name="eye_color" placeholder="blue" defaultValue={profile?.appearance?.eye_color} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="hair">Hair</Label>
        <Input id="hair" name="hair" placeholder="long curly brown hair" defaultValue={hair} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="personality_tags">Personality</Label>
        <Input
          id="personality_tags"
          name="personality_tags"
          placeholder="curious and adventurous, loves dinosaurs and building things"
          defaultValue={personality}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="toy_name">Favorite toy name</Label>
          <Input id="toy_name" name="toy_name" placeholder="Teddy" defaultValue={toyName} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="toy_description">Toy description</Label>
          <Input id="toy_description" name="toy_description" placeholder="a worn brown stuffed bear" defaultValue={toyDesc} />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving..." : profile ? "Save Changes" : "Add Profile"}
      </Button>
    </form>
  )
}
