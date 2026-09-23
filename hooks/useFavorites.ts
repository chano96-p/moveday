'use client'

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'moveday:favorites'
const EVENT_NAME = 'moveday:favorites-change'

function readFavorites(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function writeFavorites(ids: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // localStorage를 쓸 수 없는 환경(프라이빗 모드 등)에서는 조용히 무시한다.
  }
  window.dispatchEvent(new CustomEvent<string[]>(EVENT_NAME, { detail: ids }))
}

/**
 * 관심 공고 id 목록을 localStorage에 저장한다.
 * SSR에서는 빈 배열로 렌더하고 `useEffect` 이후에만 실제 값을 읽어 하이드레이션 불일치를 피한다.
 * 여러 `FavoriteStar` 인스턴스가 동시에 떠 있을 수 있으므로 커스텀 이벤트로 동기화한다.
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([])

  useEffect(() => {
    setFavorites(readFavorites())
    const handler = (event: Event) => {
      setFavorites((event as CustomEvent<string[]>).detail)
    }
    window.addEventListener(EVENT_NAME, handler)
    return () => window.removeEventListener(EVENT_NAME, handler)
  }, [])

  const toggle = useCallback((id: string) => {
    const current = readFavorites()
    const next = current.includes(id) ? current.filter((v) => v !== id) : [...current, id]
    writeFavorites(next)
  }, [])

  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites])

  return { favorites, isFavorite, toggle }
}
