import { notFound } from "next/navigation"
import { StoryGenerator } from "@/components/generate/story-generator"

export default function GenerateHarnessPage() {
  if (process.env.NEXT_PUBLIC_E2E_TEST !== "true") notFound()

  return (
    <main className="min-h-screen bg-background p-6">
      <StoryGenerator
        profiles={[
          { id: "kid-luna", name: "Luna", age: 6, age_months: 3 },
          { id: "kid-max", name: "Max", age: 4, age_months: 0 },
        ]}
        storyTypes={[
          { id: "type-adventure", name: "Adventure", description: "An adventure story", extra_input_label: null, extra_input_hint: null },
        ]}
        artStyles={[
          { id: "style-watercolor", name: "Watercolor" },
          { id: "style-crayon", name: "Crayon" },
        ]}
        credits={8}
        imagesAvailable={true}
      />
    </main>
  )
}
