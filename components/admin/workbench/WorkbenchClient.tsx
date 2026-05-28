"use client"

import { useState } from "react"
import { StoryGenerationTab } from "./StoryGenerationTab"
import { CharacterReferencesTab } from "./CharacterReferencesTab"

interface Profile {
  id: string
  name: string
  age: number
  age_months: number
  reference_image_path: string | null
  combined_reference_path: string | null
  character_illustration_path: string | null
}

interface StoryType {
  id: string
  name: string
  description: string
  extra_input_label: string | null
  extra_input_hint: string | null
}

interface ArtStyle {
  id: string
  name: string
}

interface WorkbenchClientProps {
  profiles: Profile[]
  storyTypes: StoryType[]
  artStyles: ArtStyle[]
}

type ActiveTab = "story" | "characters"

const TABS: { id: ActiveTab; label: string }[] = [
  { id: "story", label: "Story Generation" },
  { id: "characters", label: "Character References" },
]

export function WorkbenchClient({ profiles, storyTypes, artStyles }: WorkbenchClientProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("story")

  return (
    <div>
      <div className="flex gap-1 border-b border-border mb-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "story" && <StoryGenerationTab profiles={profiles} storyTypes={storyTypes} artStyles={artStyles} />}
      {activeTab === "characters" && <CharacterReferencesTab />}
    </div>
  )
}
