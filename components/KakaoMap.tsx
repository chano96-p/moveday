'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { cleanAddressForGeocoding } from '@/lib/address'

interface KakaoGeocodeResult {
  x: string
  y: string
}

interface KakaoGlobal {
  maps: {
    load: (callback: () => void) => void
    LatLng: new (lat: number, lng: number) => unknown
    Map: new (container: HTMLElement, options: { center: unknown; level: number }) => unknown
    Marker: new (options: { position: unknown; map: unknown }) => unknown
    services: {
      Geocoder: new () => {
        addressSearch: (address: string, callback: (result: KakaoGeocodeResult[], status: string) => void) => void
      }
      Status: { OK: string }
    }
  }
}

declare global {
  interface Window {
    kakao?: KakaoGlobal
  }
}

interface KakaoCoords {
  lat: number
  lng: number
}

/**
 * 공급위치를 지오코딩해 지도를 그린다(§9). 지구명·단지명은 검색 결과가 갈려서 주소
 * 문자열을 쓴다. 지오코딩이 실패하면 지도를 숨긴다 — 실패를 안내 문구로 채우지 않는다.
 *
 * 지오코딩과 지도 생성을 단계로 나눈다 — 지오코딩은 컨테이너가 필요 없다. 좌표가 나온
 * 뒤에야 섹션(과 실제 크기를 가진 컨테이너)을 렌더하고, 그 다음에 지도를 만든다. 섹션을
 * 먼저 그려두고 `hidden`으로 숨기면 지도가 0×0 컨테이너 기준으로 초기화돼 버린다.
 */
export function KakaoMap({ address }: { address: string | null }) {
  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY
  const containerRef = useRef<HTMLDivElement>(null)
  const [sdkReady, setSdkReady] = useState(false)
  const [coords, setCoords] = useState<KakaoCoords | null>(null)

  useEffect(() => {
    // address가 바뀌면 이전 좌표를 즉시 버린다 — 안 그러면 새 지오코딩이 끝나기 전까지
    // 이 공고 화면에 이전 공고의 위치가 그대로 남는다. 없는 것보다 틀린 것이 나쁘다(§9).
    setCoords(null)
    if (!sdkReady || !address) return
    const kakao = window.kakao
    if (!kakao) return

    // 응답이 오기 전에 다른 공고로 이동하면(주소가 바뀌거나 언마운트되면) 낡은 응답이
    // 새 상세 화면에 좌표를 심지 않도록 막는다.
    let cancelled = false
    kakao.maps.load(() => {
      const geocoder = new kakao.maps.services.Geocoder()
      geocoder.addressSearch(cleanAddressForGeocoding(address), (result, status) => {
        if (cancelled || status !== kakao.maps.services.Status.OK || !result[0]) return
        setCoords({ lat: Number(result[0].y), lng: Number(result[0].x) })
      })
    })

    return () => {
      cancelled = true
    }
  }, [sdkReady, address])

  useEffect(() => {
    if (!coords || !containerRef.current) return
    const kakao = window.kakao
    if (!kakao) return
    const center = new kakao.maps.LatLng(coords.lat, coords.lng)
    const map = new kakao.maps.Map(containerRef.current, { center, level: 3 })
    new kakao.maps.Marker({ position: center, map })
  }, [coords])

  if (!appKey || !address) return null

  return (
    <>
      <Script
        src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=services`}
        onReady={() => setSdkReady(true)}
      />
      {coords && (
        <section aria-label="공급위치 지도">
          <h2 className="mb-3 text-sm font-medium text-ink-muted">공급위치</h2>
          <div ref={containerRef} className="h-64 w-full rounded-lg border border-border" />
        </section>
      )}
    </>
  )
}
