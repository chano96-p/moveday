import { describe, expect, it } from 'vitest'
import { competitionOperationFor, groupCompetitionRows } from '@/lib/applyhome/competition'
import { joinCompetition, pickPrimaryCompetition } from '@/lib/applyhome/competitionJoin'
import { COMPETITION_OPERATIONS } from '@/lib/config'
import type { CompetitionRow, SupplyRow } from '@/lib/types'

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

  it('MODEL_NO가 없으면(getRemndrLttotPblancCmpet/getOPTLttotPblancCmpet) houseTypeKey로 폴백 조인한다', () => {
    const rows = groupCompetitionRows(
      [
        { HOUSE_TY: '084.9500A', REQ_CNT: '5', CMPET_RATE: '1.00' },
        { HOUSE_TY: '84㎡A', REQ_CNT: '7', CMPET_RATE: '1.50' },
      ],
      COMPETITION_OPERATIONS.OPT,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].modelNo).toBeNull()
    expect(rows[0].competition).toHaveLength(2)
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
      rows: [{ modelNo: '01', houseType: '084A', houseTypeKey: '84A', competition: [competitionRow({ rateRaw: '1.10' })] }],
      specialSupply: { available: false, byType: [] },
      joinedBy: 'modelNo',
    })
    expect(result[0].competition?.rateRaw).toBe('1.10')
  })

  it('houseTypeKey로 폴백 조인한다(MODEL_NO 없는 오퍼레이션)', () => {
    const supply = [supplyRow({ modelNo: '01', houseTypeKey: '59A' })]
    const result = joinCompetition(supply, {
      rows: [{ modelNo: null, houseType: '59㎡A', houseTypeKey: '59A', competition: [competitionRow({ rateRaw: '1.50' })] }],
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
