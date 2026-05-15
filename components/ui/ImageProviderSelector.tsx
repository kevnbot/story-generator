import { PROVIDER_OPTIONS } from "@/lib/ai/image-providers/index"

interface Props {
  value: string
  onChange: (value: string) => void
}

export function ImageProviderSelector({ value, onChange }: Props) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
    >
      {PROVIDER_OPTIONS.map(opt => (
        <option key={opt.id} value={opt.id}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
