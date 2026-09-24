import { describe, expect, it } from 'vitest'
import { competitionOperationFor, groupCompetitionRows, groupWinnerScores, toSpecialSupplyByType } from '@/lib/applyhome/competition'
import { joinCompetition, pickPrimaryCompetition } from '@/lib/applyhome/competitionJoin'
import { ADAPTERS } from '@/lib/applyhome/adapters'
import { COMPETITION_OPERATIONS } from '@/lib/config'
import type { CompetitionRow, SupplyRow } from '@/lib/types'

import remndrMdlExtra from './fixtures/dev/remndr-mdl-extra.json'
import remndrCmpetDev from './fixtures/competition/remndr-cmpet.json'

function competitionRow(overrides: Partial<CompetitionRow>): CompetitionRow {
  return { rankCode: null, resideKind: null, resideArea: null, units: null, requestCount: null, rate: null, rateRaw: '', ...overrides }
}

function supplyRow(overrides: Partial<SupplyRow>): SupplyRow {
  return {
    modelNo: '01',
    houseType: '',
    houseTypeKey: '',
    area: { value: null, kind: 'supply' },
    generalUnits: null,
    specialUnits: null,
    specialBreakdown: null,
    price: null,
    ...overrides,
  }
}

// 조인 로직은 순수 함수이고 폴백 분기가 있어 §4.6 예외로 테스트한다(팀 리드 승인).
describe('competitionOperationFor', () => {
  it('APT/URBTY_OFCTL/PBL_PVT_RENT/OPT는 고정 오퍼레이션이다', () => {
    expect(competitionOperationFor('APT', null)).toBe(COMPETITION_OPERATIONS.APT)
    expect(competitionOperationFor('URBTY_OFCTL', null)).toBe(COMPETITION_OPERATIONS.URBTY_OFCTL)
    expect(competitionOperationFor('PBL_PVT_RENT', null)).toBe(COMPETITION_OPERATIONS.PBL_PVT_RENT)
    expect(competitionOperationFor('OPT', null)).toBe(COMPETITION_OPERATIONS.OPT)
  })

  it('REMNDR은 houseSecd로 갈린다 — 04 무순위, 06 취소후재공급', () => {
    expect(competitionOperationFor('REMNDR', '04')).toBe(COMPETITION_OPERATIONS.REMNDR_04)
    expect(competitionOperationFor('REMNDR', '06')).toBe(COMPETITION_OPERATIONS.REMNDR_06)
  })

  it('REMNDR의 houseSecd가 04/06 외 값(미확인)이면 무순위로 취급한다', () => {
    expect(competitionOperationFor('REMNDR', null)).toBe(COMPETITION_OPERATIONS.REMNDR_04)
    expect(competitionOperationFor('REMNDR', '99')).toBe(COMPETITION_OPERATIONS.REMNDR_04)
  })
})

describe('groupCompetitionRows', () => {
  it('MODEL_NO가 있으면 그걸로 조인해 같은 모델의 행을 하나로 묶는다', () => {
    const rows = groupCompetitionRows(
      [
        { MODEL_NO: '01', HOUSE_TY: '084A', SUBSCRPT_RANK_CODE: 1, REQ_CNT: '10', CMPET_RATE: '1.10' },
        { MODEL_NO: '01', HOUSE_TY: '084A', SUBSCRPT_RANK_CODE: 2, REQ_CNT: '20', CMPET_RATE: '2.00' },
        { MODEL_NO: '02', HOUSE_TY: '099A', SUBSCRPT_RANK_CODE: 1, REQ_CNT: '5', CMPET_RATE: '0.50' },
      ],
      COMPETITION_OPERATIONS.APT,
    )
    expect(rows).toHaveLength(2)
    const model01 = rows.find((r) => r.modelNo === '01')
    expect(model01?.competition).toHaveLength(2)
  })

  it('MODEL_NO가 없으면(getRemndrLttotPblancCmpet/getOPTLttotPblancCmpet) houseTypeKey(원문)로 폴백 조인한다', () => {
    const rows = groupCompetitionRows(
      [
        { HOUSE_TY: '59A-1', REQ_CNT: '5', CMPET_RATE: '1.00' },
        { HOUSE_TY: '59A-1', REQ_CNT: '7', CMPET_RATE: '1.50' },
      ],
      COMPETITION_OPERATIONS.OPT,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].modelNo).toBeNull()
    expect(rows[0].competition).toHaveLength(2)
  })

  // Phase 8 실측 — 이전 정규화는 숫자로 끝나는 TP 값에서 접미사 정규식이 매칭에 실패해
  // 서로 다른 주택형을 같은 키로 뭉갰다(84/84A1/84A2/84A-1/84B-1/84C-1 → "84"). 원문
  // 비교로는 이 값들이 서로 다른 그룹으로 남아야 한다.
  it('숫자로 끝나는 TP 값끼리는 서로 다른 주택형으로 남는다(조인 충돌 회귀)', () => {
    const rows = groupCompetitionRows(
      [
        { HOUSE_TY: '84A1', REQ_CNT: '5', CMPET_RATE: '1.00' },
        { HOUSE_TY: '84A-1', REQ_CNT: '7', CMPET_RATE: '1.50' },
      ],
      COMPETITION_OPERATIONS.OPT,
    )
    expect(rows).toHaveLength(2)
  })

  it('취소후재공급(getCancResplLttotPblancCmpet)은 한 행의 유형별 접두어 열을 분해해 여러 CompetitionRow로 만든다', () => {
    const rows = groupCompetitionRows(
      [
        {
          MODEL_NO: '01',
          HOUSE_TY: '059A',
          NORMAL_HSHLDCO: 5,
          NORMAL_REQ_CNT: '10',
          NORMAL_CMPET_RATE: '2.00',
          MNYCH_HSHLDCO: 1,
          MNYCH_REQ_CNT: '3',
          MNYCH_CMPET_RATE: '3.00',
        },
      ],
      COMPETITION_OPERATIONS.REMNDR_06,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].competition.map((c) => c.resideArea)).toEqual(['일반공급', '다자녀'])
  })

  it('조인 실패는 빈 배열이다 — 원본 행이 없으면 아무 것도 묶이지 않는다', () => {
    expect(groupCompetitionRows([], COMPETITION_OPERATIONS.APT)).toEqual([])
  })
})

// getAPTSpsplyReqstStus는 공고당 1행이 아니라 주택형별 다행이다(Phase 8 실측) — 첫 행만 쓰면
// 다른 주택형의 값이 통째로 빠져 공고 전체 건수를 몇 분의 1로 줄여 보여준다(BLOCKER 회귀).
describe('toSpecialSupplyByType — 주택형별 다행을 공고 전체로 합산한다', () => {
  it('같은 항목의 배정세대수·접수건수를 주택형 전부에 걸쳐 더한다', () => {
    const rows = [
      { MNYCH_HSHLDCO: 4, CRSPAREA_MNYCH_CNT: 1, CTPRVN_MNYCH_CNT: 0, ETC_AREA_MNYCH_CNT: 0 },
      { MNYCH_HSHLDCO: 3, CRSPAREA_MNYCH_CNT: 0, CTPRVN_MNYCH_CNT: 0, ETC_AREA_MNYCH_CNT: 0 },
    ]
    const byType = toSpecialSupplyByType(rows)
    const mnych = byType.find((r) => r.label === '다자녀')
    expect(mnych?.units).toBe(7) // 4 + 3, 첫 행만 쓰면 4로 축소됐을 자리
    expect(mnych?.requestCounts.find((c) => c.area === '해당')?.count).toBe(1)
  })

  it('한 행만 있으면 이전과 같은 값이다(회귀 없음)', () => {
    const byType = toSpecialSupplyByType([{ MNYCH_HSHLDCO: 4, CRSPAREA_MNYCH_CNT: 1 }])
    expect(byType.find((r) => r.label === '다자녀')?.units).toBe(4)
  })

  it('행이 비어 있으면 빈 배열이다', () => {
    expect(toSpecialSupplyByType([])).toEqual([])
  })
})

// RESIDE_SECD 매핑은 뒤바뀌어도 현재 화면에 증상이 없다(선택 규칙은 '01'만 읽고 표기는
// resideArea를 쓴다). etcGyeonggi/etcArea를 읽는 로직이 생기는 순간 활성화되는 함정이라
// 방향을 고정한다 — §4.0의 교훈.
describe('RESIDE_SECD → resideKind 매핑 방향', () => {
  const rowsFor = (resideSecd: string) =>
    groupCompetitionRows(
      [{ MODEL_NO: '01', HOUSE_TY: '084.9500A', RESIDE_SECD: resideSecd, RESIDE_SENM: '표시명', CMPET_RATE: '1.00' }],
      COMPETITION_OPERATIONS.APT,
    )[0].competition[0]

  it('01은 해당지역이다', () => {
    expect(rowsFor('01').resideKind).toBe('corresponding')
  })

  it('02는 기타지역, 03은 기타경기다 — 뒤바뀌면 대표값 선택이 틀린 행을 고른다', () => {
    expect(rowsFor('02').resideKind).toBe('etcArea')
    expect(rowsFor('03').resideKind).toBe('etcGyeonggi')
  })

  it('모르는 코드와 필드 부재는 null이다', () => {
    expect(rowsFor('99').resideKind).toBeNull()
  })
})

// groupCompetitionRows와 같은 성격의 순수 함수라 여기 둔다(페이지에 있으면 테스트가 안 된다).
describe('pickPrimaryCompetition', () => {
  it('1순위+해당지역이 있으면 그걸 고른다', () => {
    const rows = [
      competitionRow({ rankCode: 2, resideKind: 'etcArea', rateRaw: '2.00' }),
      competitionRow({ rankCode: 1, resideKind: 'corresponding', rateRaw: '1.00' }),
    ]
    expect(pickPrimaryCompetition(rows)?.rateRaw).toBe('1.00')
  })

  it('1순위+해당지역이 없으면 최저 순위를 고른다', () => {
    const rows = [competitionRow({ rankCode: 2, rateRaw: '2.00' }), competitionRow({ rankCode: 1, rateRaw: '1.00' })]
    expect(pickPrimaryCompetition(rows)?.rateRaw).toBe('1.00')
  })

  it('순위가 전혀 없으면(REMNDR/OPT/CancRespl) 첫 항목을 고른다', () => {
    const rows = [competitionRow({ rateRaw: '3.00' }), competitionRow({ rateRaw: '4.00' })]
    expect(pickPrimaryCompetition(rows)?.rateRaw).toBe('3.00')
  })

  it('빈 배열은 undefined다', () => {
    expect(pickPrimaryCompetition([])).toBeUndefined()
  })
})

describe('joinCompetition', () => {
  it('modelNo로 조인해 competition·score를 채운다', () => {
    const supply = [supplyRow({ modelNo: '01' })]
    const result = joinCompetition(supply, {
      rows: [{ modelNo: '01', houseType: '084A', houseTypeKey: '084A', competition: [competitionRow({ rateRaw: '1.10' })] }],
      specialSupply: { available: false, byType: [] },
      joinedBy: 'modelNo',
    })
    expect(result[0].competition?.rateRaw).toBe('1.10')
  })

  it('houseTypeKey(원문)로 폴백 조인한다(MODEL_NO 없는 오퍼레이션)', () => {
    const supply = [supplyRow({ modelNo: '01', houseTypeKey: '59A-1' })]
    const result = joinCompetition(supply, {
      rows: [{ modelNo: null, houseType: '59A-1', houseTypeKey: '59A-1', competition: [competitionRow({ rateRaw: '1.50' })] }],
      specialSupply: { available: false, byType: [] },
      joinedBy: 'houseTypeKey',
    })
    expect(result[0].competition?.rateRaw).toBe('1.50')
  })

  it('조인 실패는 에러가 아니다 — 원래 행을 그대로 둔다', () => {
    const supply = [supplyRow({ modelNo: '01' })]
    const result = joinCompetition(supply, { rows: [], specialSupply: { available: false, byType: [] }, joinedBy: 'modelNo' })
    expect(result[0].competition).toBeUndefined()
  })

  it('competition이 undefined면(로딩 전) supply를 그대로 반환한다', () => {
    const supply = [supplyRow({ modelNo: '01' })]
    expect(joinCompetition(supply, undefined)).toBe(supply)
  })
})

// 리뷰어 NIT — dev 픽스처 쌍(remndr-mdl-extra.json ↔ remndr-cmpet.json)의 HOUSE_TY가 어긋나도
// 120개 단위 테스트가 전부 통과했다. dev 픽스처는 MOVEDAY_USE_FIXTURES 경로에서만 로드돼
// 단위 테스트가 못 보기 때문이다. 문자열이 같다가 아니라 실제 파이프라인(어댑터 → 조인)을
// 태워서 "조인이 성사된다"를 단언한다 — 표기가 바뀌어도 양쪽이 같기만 하면 통과한다.
describe('dev 픽스처 쌍 — remndr-mdl-extra ↔ remndr-cmpet 폴백 조인', () => {
  it('실제 어댑터·조인 파이프라인을 태워도 경쟁률이 붙는다', () => {
    const supply = ADAPTERS.REMNDR.toSupplyRows(remndrMdlExtra.data)
    const grouped = groupCompetitionRows(remndrCmpetDev.data, COMPETITION_OPERATIONS.REMNDR_04)
    const result = joinCompetition(supply, { rows: grouped, specialSupply: { available: false, byType: [] }, joinedBy: 'houseTypeKey' })

    expect(result[0].competition).toBeDefined()
    expect(result[0].competition?.rateRaw).toBe(remndrCmpetDev.data[0].CMPET_RATE)
  })
})

// 프로덕션 실측(2026-09-24, 공고 2026000419) — 같은 MODEL_NO에 대해 거주지역별로 2행이 온다.
// 기타지역은 배정이 없으면 0/0/0으로 오는데, Map에 덮어쓰면 그게 해당지역의 실제 가점
// (최저 42 · 최고 79)을 지운다. 배포된 API가 실제로 {lowest:0,highest:0}을 내고 있었다.
describe('groupWinnerScores', () => {
  const rowsOf2026000419 = [
    { MODEL_NO: '01', RESIDE_SECD: '01', RESIDE_SENM: '해당지역', LWET_SCORE: '42', TOP_SCORE: '79', AVRG_SCORE: '51.79' },
    { MODEL_NO: '01', RESIDE_SECD: '02', RESIDE_SENM: '기타지역', LWET_SCORE: '0', TOP_SCORE: '0', AVRG_SCORE: '0' },
  ]

  it('해당지역 행을 대표값으로 고른다 — 뒤에 오는 기타지역 0점이 덮어쓰지 않는다', () => {
    const scores = groupWinnerScores(rowsOf2026000419)
    expect(scores.get('model:01')).toEqual({ lowest: 42, highest: 79, average: 51.79 })
  })

  it('해당지역이 뒤에 와도 이긴다 — 행 순서에 의존하지 않는다', () => {
    const scores = groupWinnerScores([...rowsOf2026000419].reverse())
    expect(scores.get('model:01')?.lowest).toBe(42)
  })

  it('거주지역 구분이 없는 행도 그대로 들어온다', () => {
    const scores = groupWinnerScores([{ MODEL_NO: '07', LWET_SCORE: '55', TOP_SCORE: '70', AVRG_SCORE: '60' }])
    expect(scores.get('model:07')?.lowest).toBe(55)
  })

  it('값이 "-"면 null이다 — 0으로 떨어뜨리지 않는다(§4.3②)', () => {
    const scores = groupWinnerScores([{ MODEL_NO: '02', RESIDE_SECD: '01', LWET_SCORE: '-', TOP_SCORE: '-', AVRG_SCORE: '-' }])
    expect(scores.get('model:02')).toEqual({ lowest: null, highest: null, average: null })
  })
})
