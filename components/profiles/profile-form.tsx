"use client"

import { useActionState, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createProfile } from "@/app/actions/profiles"

const PERSONALITY_OPTIONS = [
  "adventurous", "curious", "brave", "kind", "funny",
  "imaginative", "creative", "gentle", "energetic", "loving",
]

export function ProfileForm({ onSuccess }: { onSuccess?: () => void }) {
  const [error, action, pending] = useActionState(
    async (prev: string | null, formData: FormData) => {
      const result = await createProfile(prev, formData)
      if (!result && onSuccess) onSuccess()
      return result
    },
    null
  )
  const [selected, setSelected] = useState<string[]>([])

  const toggle = (tag: string) =>
    setSelected(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])

  return (
    <form action={action} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Child's name</Label>
          <Input id="name" name="name" placeholder="Emma" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="age">Age</Label>
          <Input id="age" name="age" type="number" min="1" max="12" placeholder="5" required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="hair_color">Hair color</Label>
          <Input id="hair_color" name="hair_color" placeholder="brown" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="eye_color">Eye color</Label>
          <Input id="eye_color" name="eye_color" placeholder="blue" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Personality</Label>
        <div className="flex flex-wrap gap-2">
          {PERSONALITY_OPTIONS.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                selected.includes(tag)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input bg-background hover:bg-accent"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
        <input type="hidden" name="personality_tags" value={selected.join(",")} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="toy_name">Favorite toy name</Label>
          <Input id="toy_name" name="toy_name" placeholder="Teddy" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="toy_type">Toy type</Label>
          <Input id="toy_type" name="toy_type" placeholder="stuffed bear" />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving..." : "Add Profile"}
      </Button>
    </form>
  )
}
