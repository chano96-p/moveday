import { describe, expect, it } from 'vitest'
import { formatCondDate, normalizeHouseType, parseAmount, parseCount, parseIsoDate } from '@/lib/applyhome/parse'

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

describe('normalizeHouseType', () => {
  it('스펙 표기와 라이브 캡처 표기가 같은 키로 정규화된다', () => {
    expect(normalizeHouseType('084.9500A')).toBe('84A')
    expect(normalizeHouseType('84㎡A')).toBe('84A')
  })

  it('선행 숫자 + 말미 영문 접미사를 뽑는다', () => {
    expect(normalizeHouseType('55㎡O')).toBe('55O')
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
