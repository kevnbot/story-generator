export function listTextProviders(): { id: string; label: string }[] {
  return [
    { id: "anthropic", label: "Anthropic (Claude)" },
    { id: "openai", label: "OpenAI (GPT-4o)" },
    { id: "user_upload", label: "User Upload" },
  ]
}
