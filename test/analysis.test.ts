import { describe, expect, it } from 'vitest'
import { extractOutputText } from '@/lib/gemini/client'
import { resolveModel } from '@/lib/config'
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
    expect(input).toContain('5억 6,700만')
    expect(input).toContain('투기과열지구')
  })

  // 경쟁률이 없는데 빈 배열이나 0을 넣으면 모델이 "경쟁률 0"으로 읽는다.
  it('경쟁률이 없으면 null로 넘긴다', () => {
    expect(JSON.parse(input.slice(input.indexOf('{'))).경쟁률).toBeNull()
  })

  // 주택형 코드가 문장에 섞여 나오는 것을 막으려고 사람이 읽을 표기를 같이 넘긴다.
  // 조인 키를 넘기면 모델이 문장에 그대로 옮겨 적는다. 사람이 읽을 이름만 넘긴다.
  it('주택형을 사람이 읽을 이름으로 바꿔 넘긴다', () => {
    expect(input).toContain('공급 85㎡')
    expect(input).not.toContain('84.9500A')
  })

  // OPT Mdl에는 면적 필드가 없다. formatArea(null)의 '-'를 그대로 쓰면 `공급 -`이 문장에 나간다.
  it('면적이 없으면 주택형 원문으로 떨어진다', () => {
    const noArea = buildAnalysisInput({
      notice: NOTICE,
      supply: [{ ...SUPPLY[0], area: { value: null, kind: 'supply' } }],
      regulation: { available: false, flags: [] },
      competition: null,
      market: [],
    })
    expect(noArea).toContain('"주택형": "84.9500A"')
    expect(noArea).not.toContain('공급 -')
  })
})

describe('buildAnalysisInput — 변동률 방향', () => {
  function inputWithChange(mom: number | null) {
    return buildAnalysisInput({
      notice: NOTICE,
      supply: SUPPLY,
      regulation: { available: false, flags: [] },
      competition: null,
      market: [
        {
          key: 'sale',
          label: '아파트 매매가격지수',
          points: [{ month: '2026-08', value: 99.6884213004185 }],
          change: { mom, yoy: null },
        },
      ],
    })
  }

  // 부호 붙은 숫자를 넘기면 "상승"인지 "하락"인지가 모델의 해석에 달린다.
  it.each([
    [-0.16, '0.16% 하락'],
    [1.05, '1.05% 상승'],
    [0, '보합'],
  ])('%s는 "%s"로 넘어간다', (mom, expected) => {
    expect(inputWithChange(mom as number)).toContain(expected)
  })

  // 지수 원값(소수 12자리)이 그대로 들어가면 모델이 문장에 옮겨 적는다.
  it('지수는 소수 1자리로 줄여 넘긴다', () => {
    const input = inputWithChange(null)
    expect(input).toContain('99.7')
    expect(input).not.toContain('99.6884213004185')
  })

  // `2026-08`을 그대로 주면 모델이 "2026-08 기준"이라고 옮겨 적는다.
  it('기준월을 읽는 형태로 넘긴다', () => {
    expect(inputWithChange(null)).toContain('2026년 8월')
  })
})

describe('resolveModel', () => {
  const DEFAULT = 'gemini-3.1-flash-lite'

  // `.env.example`을 복사하면 GEMINI_MODEL=(빈 값)이 된다. `??`로 받으면 이 빈 문자열이
  // 기본값을 덮어써 모델명 ''로 호출이 나가고 상류가 404 Model '' not found를 낸다.
  it.each(['', '   ', undefined])('설정되지 않은 값(%j)은 기본 모델로 떨어진다', (value) => {
    expect(resolveModel(value)).toBe(DEFAULT)
  })

  it('지정한 모델을 쓴다', () => {
    expect(resolveModel('gemini-3.8-flash')).toBe('gemini-3.8-flash')
  })

  it('앞뒤 공백을 지운다', () => {
    expect(resolveModel('  gemini-3.8-flash  ')).toBe('gemini-3.8-flash')
  })
})
