const inflight = new Map<string, Promise<unknown>>()

/**
 * 같은 키로 동시에 들어온 요청을 한 번만 실행하고 결과를 합류시킨다.
 * Next Data Cache(`fetch`의 `next.revalidate`)는 저장은 해주지만
 * 동시 cold miss를 합쳐주지 않기 때문에 필요하다(§6).
 * 프로세스 단위 맵이라 서버리스 인스턴스별로만 합쳐진다 — 인스턴스 내 중복 제거 장치다.
 */
export function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key)
  if (existing) return existing as Promise<T>
  const promise = fn().finally(() => inflight.delete(key))
  inflight.set(key, promise)
  return promise
}
