'use client'

import Image from 'next/image'
import { useFavorites } from '@/hooks/useFavorites'

/**
 * 관심 토글(Figma `star-btn` 3:130). 테두리 박스 안의 별 아이콘, 활성 시 채운 별 + 브랜드 틴트.
 *
 * 디자인 에셋은 `star-off`(빗금 친 별)였는데 "관심 추가" 버튼에서는 "알림 끄기"로 읽혀
 * 같은 규격(16×16 · stroke 2 · lucide 계열)의 일반 별로 교체했다(사용자 확인).
 */
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
      <Image src={active ? '/icons/star-filled.svg' : '/icons/star.svg'} alt="" width={16} height={16} aria-hidden />
    </button>
  )
}
