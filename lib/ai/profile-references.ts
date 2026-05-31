import type { KidProfile } from "@/types"

export type ProfileReferenceStorageField =
  | "combined_reference_path"
  | "character_illustration_path"
  | "reference_image_path"
  | "reference_image_url"
  | "none"

export interface ProfileReference {
  profileId: string
  name: string
  url: string | null
  storageField: ProfileReferenceStorageField
}

export type ProfileReferenceProfile = Pick<
  KidProfile,
  "id" | "name" | "reference_image_path" | "reference_image_url" | "combined_reference_path" | "character_illustration_path"
> & {
  combined_reference_url?: string | null
  character_illustration_url?: string | null
}

export function getProfileReferencePaths(profiles: ProfileReferenceProfile[]): string[] {
  return profiles.flatMap((profile) => [
    profile.combined_reference_path,
    profile.character_illustration_path,
    profile.reference_image_path,
  ]).filter((path): path is string => Boolean(path))
}

export function resolveProfileReferences(
  profiles: ProfileReferenceProfile[],
  signedUrlsByPath: Map<string, string>,
): ProfileReference[] {
  return profiles.map((profile) => {
    const candidates: Array<{
      field: ProfileReferenceStorageField
      path?: string | null
      url?: string | null
    }> = [
      {
        field: "combined_reference_path",
        path: profile.combined_reference_path,
        url: profile.combined_reference_url,
      },
      {
        field: "character_illustration_path",
        path: profile.character_illustration_path,
        url: profile.character_illustration_url,
      },
      {
        field: "reference_image_path",
        path: profile.reference_image_path,
        url: profile.reference_image_url,
      },
      {
        field: "reference_image_url",
        url: profile.reference_image_url,
      },
    ]

    for (const candidate of candidates) {
      const signedUrl = candidate.path ? signedUrlsByPath.get(candidate.path) : null
      const url = signedUrl ?? candidate.url ?? null
      if (url) {
        return {
          profileId: profile.id,
          name: profile.name,
          url,
          storageField: candidate.field,
        }
      }
    }

    return {
      profileId: profile.id,
      name: profile.name,
      url: null,
      storageField: "none",
    }
  })
}
