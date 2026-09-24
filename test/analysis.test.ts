import { describe, expect, it } from 'vitest'
import { extractOutputText } from '@/lib/gemini/client'
import { AnalysisSchema, analysisJsonSchema } from '@/lib/analysis/schema'
import { buildAnalysisInput } from '@/lib/analysis/prompt'
import type { Notice, SupplyRow } from '@/lib/types'

const VALID = {
  verdict: 'competitive',
  headline: '1순위 해당지역 경쟁률 12.4대 1입니다.',
  reasons: ['최저 당첨가점이 64점입니다.', '총 300세대 중 일반공급은 120세대입니다.'],
  priceContext: '분양가는 5억 원대입니다.',
  cautions: [],
}

describe('extractOutputText', () => {
  it('model_output step의 텍스트만 이어붙인다', () => {
    const body = {
      steps: [
        { type: 'thought', content: [{ type: 'text', text: '생각' }] },
        { type: 'model_output', content: [{ type: 'text', text: '{"a":' }] },
        { type: 'model_output', content: [{ type: 'text', text: '1}' }] },
      ],
    }
    expect(extractOutputText(body)).toBe('{"a":1}')
  })

  // 마지막 step이 도구 호출이면 steps.at(-1)로 집는 구현은 빈 문자열을 낸다.
  it('마지막 step이 model_output이 아니어도 본문을 찾는다', () => {
    const body = {
      steps: [
        { type: 'model_output', content: [{ type: 'text', text: 'ok' }] },
        { type: 'tool_call', content: [] },
      ],
    }
    expect(extractOutputText(body)).toBe('ok')
  })

  it('steps가 없으면 빈 문자열이다', () => {
    expect(extractOutputText({})).toBe('')
    expect(extractOutputText(null)).toBe('')
  })
})

describe('analysisJsonSchema', () => {
  const schema = analysisJsonSchema()

  // $schema는 JSON Schema 메타 키다. Gemini의 스키마 서브셋에 넘기면 안 된다.
  it('$schema 메타 키를 빼고 넘긴다', () => {
    expect(schema).not.toHaveProperty('$schema')
  })

  it('zod 정의와 같은 필드를 요구한다', () => {
    expect(schema.required).toEqual(
      expect.arrayContaining(['verdict', 'headline', 'reasons', 'priceContext', 'cautions']),
    )
  })

  it('verdict를 enum으로 고정한다', () => {
    const properties = schema.properties as Record<string, { enum?: string[] }>
    expect(properties.verdict.enum).toEqual(['competitive', 'moderate', 'accessible'])
  })
})

describe('AnalysisSchema', () => {
  it('정상 응답을 통과시킨다', () => {
    expect(AnalysisSchema.safeParse(VALID).success).toBe(true)
  })

  it('필드가 빠지면 떨어뜨린다', () => {
    const missing: Record<string, unknown> = { ...VALID }
    delete missing.priceContext
    expect(AnalysisSchema.safeParse(missing).success).toBe(false)
  })

  it('근거가 1개면 떨어뜨린다', () => {
    expect(AnalysisSchema.safeParse({ ...VALID, reasons: ['하나뿐'] }).success).toBe(false)
  })

  it('정의에 없는 verdict를 떨어뜨린다', () => {
    expect(AnalysisSchema.safeParse({ ...VALID, verdict: 'unknown' }).success).toBe(false)
  })
})

const NOTICE: Notice = {
  id: '2026000123',
  houseManageNo: '2026000123',
  houseSecd: '01',
  type: 'APT',
  houseName: '테스트아파트',
  region: '서울',
  address: '서울특별시 강남구 일원',
  noticeDate: '2026-09-01',
  receipt: [{ kind: 'first', area: 'corresponding', start: '2026-09-10', end: '2026-09-10' }],
  receiptStart: '2026-09-10',
  receiptEnd: '2026-09-12',
  winnerDate: '2026-09-20',
  contractStart: null,
  contractEnd: null,
  minPrice: null,
  maxPrice: null,
  totalUnits: 300,
  noticeUrl: null,
  developer: null,
  builder: null,
  contact: null,
  moveInMonth: '2029-03',
}

const SUPPLY: SupplyRow[] = [
  {
    modelNo: '01',
    houseType: '84.9500A',
    houseTypeKey: '84.9500A',
    area: { value: 84.95, kind: 'supply' },
    generalUnits: 120,
    specialUnits: 180,
    specialBreakdown: null,
    price: 56700,
  },
]

describe('buildAnalysisInput', () => {
  const input = buildAnalysisInput({
    notice: NOTICE,
    supply: SUPPLY,
    regulation: { available: true, flags: [{ key: 'SPECLT_RDN_EARTH_AT', label: '투기과열지구' }] },
    competition: null,
    market: [],
  })

  it('정규화된 값을 담는다', () => {
    expect(input).toContain('테스트아파트')
    expect(input).toContain('2026-09-10')
    expect(input).toContain('56700')
    expect(input).toContain('투기과열지구')
  })

  // 경쟁률이 없는데 빈 배열이나 0을 넣으면 모델이 "경쟁률 0"으로 읽는다.
  it('경쟁률이 없으면 null로 넘긴다', () => {
    expect(JSON.parse(input.slice(input.indexOf('{'))).경쟁률).toBeNull()
  })

  it('면적 종류를 이름으로 푼다', () => {
    expect(input).toContain('공급면적')
  })
})
