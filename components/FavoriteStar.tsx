'use client'

import Image from 'next/image'
import { useFavorites } from '@/hooks/useFavorites'

/** 관심 토글(Figma `star-btn` 3:130). 테두리 박스 안의 별 아이콘, 활성 시 브랜드 틴트. */
export function FavoriteStar({ id }: { id: string }) {
  const { isFavorite, toggle } = useFavorites()
  const active = isFavorite(id)

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? '관심 공고 해제' : '관심 공고 추가'}
      onClick={(event) => {
        event.stopPropagation()
        toggle(id)
      }}
      className={`rounded-field border p-1.5 transition-colors ${
        active ? 'border-brand bg-brand-tint' : 'border-border bg-surface hover:border-ink-muted'
      }`}
    >
      <Image
        src="/icons/star-off.svg"
        alt=""
        width={16}
        height={16}
        aria-hidden
        className={active ? 'opacity-100' : 'opacity-60'}
      />
    </button>
  )
}
