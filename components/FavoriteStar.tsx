'use client'

import { useFavorites } from '@/hooks/useFavorites'

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
      className={active ? 'text-ink' : 'text-ink-muted hover:text-ink'}
    >
      {active ? '★' : '☆'}
    </button>
  )
}
