'use client'

import { REGIONS } from '@/lib/config'
import type { Region } from '@/lib/types'

export function RegionFilter({ value, onChange }: { value: Region[]; onChange: (regions: Region[]) => void }) {
  function toggle(region: Region) {
    onChange(value.includes(region) ? value.filter((r) => r !== region) : [...value, region])
  }

  return (
    <fieldset className="flex flex-wrap gap-2">
      <legend className="sr-only">지역 필터</legend>
      {REGIONS.map((region) => {
        const active = value.includes(region)
        return (
          <label
            key={region}
            className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${
              active ? 'border-ink bg-ink text-white' : 'border-border text-ink-muted hover:text-ink'
            }`}
          >
            <input type="checkbox" checked={active} onChange={() => toggle(region)} className="sr-only" />
            {region}
          </label>
        )
      })}
    </fieldset>
  )
}
