import { describe, expect, it } from 'vitest'
import {
  formatCondDate,
  isMeaningfulValue,
  parseAmount,
  parseCompetitionRate,
  parseCount,
  parseIsoDate,
  toHouseTypeKey,
} from '@/lib/applyhome/parse'

describe('parseIsoDate', () => {
  it('compact(YYYYMMDD) 형식을 ISO로 변환한다', () => {
    expect(parseIsoDate('20260813')).toBe('2026-08-13')
  })

  it('iso(YYYY-MM-DD) 형식은 그대로 통과시킨다', () => {
    expect(parseIsoDate('2026-08-13')).toBe('2026-08-13')
  })

  it('빈 문자열 · "-" · null은 모두 null이다', () => {
    expect(parseIsoDate('')).toBeNull()
    expect(parseIsoDate('-')).toBeNull()
    expect(parseIsoDate(null)).toBeNull()
    expect(parseIsoDate(undefined)).toBeNull()
  })

  it('두 형식이 혼재해도 문자열 비교가 뒤집히지 않는다', () => {
    const compact = parseIsoDate('20260813')  // PblPvtRent/OPT
    const iso = parseIsoDate('2026-08-20')    // APT 등
    expect(compact).not.toBeNull()
    expect(iso).not.toBeNull()
    expect(compact! < iso!).toBe(true)
  })
})

describe('parseAmount', () => {
  it('쉼표가 있는 금액을 숫자로 변환한다', () => {
    expect(parseAmount('27,600')).toBe(27600)
  })

  it('쉼표가 없는 금액도 그대로 변환한다', () => {
    expect(parseAmount('36707')).toBe(36707)
  })

  it('빈 문자열은 null이다 (0이 아니다)', () => {
    expect(parseAmount('')).toBeNull()
  })

  it('숫자로 파싱할 수 없는 값은 null이다 (0이 아니다)', () => {
    expect(parseAmount('미정')).toBeNull()
  })
})

// Phase 8 실측: `㎡` 표기는 API에 실재하지 않았고(픽스처가 웹사이트 렌더링을 잘못 기록),
// 두 응답의 HOUSE_TY/TP 원문은 항상 그대로 일치했다 — 정규화는 트리밍만 한다.
describe('toHouseTypeKey', () => {
  it('원문을 트리밍만 해서 돌려준다', () => {
    expect(toHouseTypeKey('84A1')).toBe('84A1')
    expect(toHouseTypeKey(' 59A-1 ')).toBe('59A-1')
  })

  // 이전 정규화(숫자+말미 영문 접미사 추출)는 숫자로 끝나는 실제 TP 값에서 접미사 정규식이
  // 매칭에 실패해 서로 다른 주택형을 뭉갰다 — 이 값들이 서로 달라야 그 버그가 재발하지 않는다.
  it('숫자로 끝나는 값끼리도 서로 다른 키를 유지한다(조인 충돌 회귀)', () => {
    const keys = ['84', '84A1', '84A2', '84A-1', '84B-1', '84C-1'].map(toHouseTypeKey)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

// GP(군)가 없으면 빈 문자열이 아니라 "-"로 온다(Phase 8 실측) — 걸러내지 않으면
// houseType 문자열에 자리표시자가 그대로 샌다.
describe('isMeaningfulValue', () => {
  it('"-"는 의미 없는 값이다', () => {
    expect(isMeaningfulValue('-')).toBe(false)
  })

  it('빈 문자열 · null · undefined도 의미 없는 값이다', () => {
    expect(isMeaningfulValue('')).toBe(false)
    expect(isMeaningfulValue(null)).toBe(false)
    expect(isMeaningfulValue(undefined)).toBe(false)
  })

  it('그 외 값은 의미 있는 값이다', () => {
    expect(isMeaningfulValue('1')).toBe(true)
    expect(isMeaningfulValue('59A-1')).toBe(true)
  })
})

describe('parseCount', () => {
  it('정수는 그대로 반환한다', () => {
    expect(parseCount('61')).toBe(61)
  })

  it('소수는 버려서(Math.trunc) 세대수를 정수로 만든다', () => {
    expect(parseCount('12.5')).toBe(12)
  })

  it('빈 문자열 · 숫자가 아닌 값은 null이다', () => {
    expect(parseCount('')).toBeNull()
    expect(parseCount('미정')).toBeNull()
  })
})

describe('formatCondDate', () => {
  const date = new Date('2026-08-13')

  it('iso 형식 유형(APT/REMNDR/URBTY_OFCTL)은 yyyy-MM-dd로 포맷한다', () => {
    expect(formatCondDate('APT', date)).toBe('2026-08-13')
    expect(formatCondDate('REMNDR', date)).toBe('2026-08-13')
    expect(formatCondDate('URBTY_OFCTL', date)).toBe('2026-08-13')
  })

  it('compact 형식 유형(PBL_PVT_RENT/OPT)은 yyyyMMdd로 포맷한다', () => {
    expect(formatCondDate('PBL_PVT_RENT', date)).toBe('20260813')
    expect(formatCondDate('OPT', date)).toBe('20260813')
  })
})

describe('parseCompetitionRate', () => {
  it('숫자 문자열은 rate로 파싱된다', () => {
    expect(parseCompetitionRate('5.23')).toEqual({ rate: 5.23, rateRaw: '5.23' })
  })

  it('미달 표기(△)는 rate가 null이고 원문이 rateRaw에 보존된다', () => {
    expect(parseCompetitionRate('△524')).toEqual({ rate: null, rateRaw: '△524' })
  })

  it('빈 문자열은 rate가 null이다', () => {
    expect(parseCompetitionRate('')).toEqual({ rate: null, rateRaw: '' })
  })

  it('"-"는 rate가 null이다', () => {
    expect(parseCompetitionRate('-')).toEqual({ rate: null, rateRaw: '-' })
  })

  it('괄호가 붙은 미달 표기("(△9)")도 rate가 null이고 원문이 보존된다(Phase 8 실측)', () => {
    expect(parseCompetitionRate('(△9)')).toEqual({ rate: null, rateRaw: '(△9)' })
  })
})
