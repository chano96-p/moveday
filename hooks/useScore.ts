'use client'

import { useCallback, useEffect, useState } from 'react'
import { calcScore, type ScoreInput, type ScoreResult } from '@/lib/score'

const STORAGE_KEY = 'moveday:score'

function readScoreInput(): ScoreInput | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ScoreInput) : null
  } catch {
    return null
  }
}

function writeScoreInput(input: ScoreInput) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(input))
  } catch {
    // localStorage를 쓸 수 없는 환경(프라이빗 모드 등)에서는 조용히 무시한다.
  }
}

/**
 * 가점 입력값을 localStorage에 저장한다. `useFavorites()`와 같은 이유로 SSR에서는
 * `null`로 렌더하고 `useEffect` 이후에만 실제 값을 읽어 하이드레이션 불일치를 피한다.
 */
export function useScore() {
  const [input, setInput] = useState<ScoreInput | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setInput(readScoreInput())
    setLoaded(true)
  }, [])

  const save = useCallback((next: ScoreInput) => {
    writeScoreInput(next)
    setInput(next)
  }, [])

  const result: ScoreResult | null = input ? calcScore(input) : null

  return { input, result, save, loaded }
}
