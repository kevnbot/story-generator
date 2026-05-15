export const NEGATIVE_PROMPT =
  "animal features on children, animal ears on children, animal tails on children, fur on human characters, chipmunk features on child, cat features on child, dog features on child, child as animal, animal hybrid child, whiskers on human, child with tail"

export const HUMAN_RULE =
  "All characters are human children. Toys are separate stuffed objects held in hands — children have no animal features, fur, tails, or ears."

export interface StoryPagePromptParams {
  scene: string
  styleDescription: string
  characterAnchor: string
  referenceAvailable: boolean
}

export function buildStoryPagePrompt({
  scene,
  styleDescription,
  characterAnchor,
  referenceAvailable,
}: StoryPagePromptParams): string {
  if (referenceAvailable) {
    return `${scene}. ${styleDescription}. ${characterAnchor}. Maintain all characters' exact appearances from the reference image. ${HUMAN_RULE}`
  }
  return `${scene}. ${styleDescription}. ${characterAnchor}. ${HUMAN_RULE} Consistent character design throughout.`
}

export function buildReferenceStylePrompt(styleDescription: string): string {
  return `${styleDescription}. Maintain all character identities, proportions, and positions exactly as shown. Apply only the artistic rendering style — do not change who is in the image or how they are posed.`
}
