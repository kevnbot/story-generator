"use client"

import { useState } from "react"
import { StoryGenerationTab } from "./StoryGenerationTab"
import { CharacterReferencesTab } from "./CharacterReferencesTab"
import type {
  WorkbenchArtStyle,
  WorkbenchInitialStory,
  WorkbenchProfile,
  WorkbenchStoryType,
} from "@/lib/admin/workbench-preload"

interface WorkbenchClientProps {
  profiles: WorkbenchProfile[]
  storyTypes: WorkbenchStoryType[]
  artStyles: WorkbenchArtStyle[]
  initialStory?: WorkbenchInitialStory | null
}

type ActiveTab = "story" | "characters"

const TABS: { id: ActiveTab; label: string }[] = [
  { id: "story", label: "Story Generation" },
  { id: "characters", label: "Character References" },
]

export function WorkbenchClient({ profiles, storyTypes, artStyles, initialStory }: WorkbenchClientProps) {
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

      {activeTab === "story" && (
        <StoryGenerationTab
          profiles={profiles}
          storyTypes={storyTypes}
          artStyles={artStyles}
          initialStory={initialStory ?? null}
        />
      )}
      {activeTab === "characters" && <CharacterReferencesTab profiles={profiles} />}
    </div>
  )
}
