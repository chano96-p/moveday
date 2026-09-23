import { APPLYHOME_CMPET_BASE, fetchOdcloudAll } from '@/lib/applyhome/client'
import { COMPETITION_OPERATIONS } from '@/lib/config'
import { normalizeHouseType, parseAmount, parseCompetitionRate, parseCount } from '@/lib/applyhome/parse'
import type { CompetitionRow, Notice, NoticeType, ReceiptArea, WinnerScore } from '@/lib/types'

export interface CompetitionSupplyRow {
  modelNo: string | null
  houseType: string
  houseTypeKey: string
  competition: CompetitionRow[]
  score?: WinnerScore
}

export interface SpecialSupplyRequestCount {
  area: string
  count: number | null
}

export interface SpecialSupplyByType {
  label: string
  units: number | null
  requestCounts: SpecialSupplyRequestCount[]
}

export interface SpecialSupplyResult {
  available: boolean
  byType: SpecialSupplyByType[]
}

export interface CompetitionResult {
  rows: CompetitionSupplyRow[]
  specialSupply: SpecialSupplyResult
  joinedBy: 'modelNo' | 'houseTypeKey'
}

// REMNDR은 Detail의 HOUSE_SECD로 오퍼레이션이 갈린다(§3) — 04 무순위, 06 취소후재공급.
// 04/06 외 값(미확인 케이스)은 더 흔한 무순위로 취급한다.
export function competitionOperationFor(type: NoticeType, houseSecd: string | null): string {
  switch (type) {
    case 'APT':
      return COMPETITION_OPERATIONS.APT
    case 'URBTY_OFCTL':
      return COMPETITION_OPERATIONS.URBTY_OFCTL
    case 'PBL_PVT_RENT':
      return COMPETITION_OPERATIONS.PBL_PVT_RENT
    case 'OPT':
      return COMPETITION_OPERATIONS.OPT
    case 'REMNDR':
      return houseSecd === '06' ? COMPETITION_OPERATIONS.REMNDR_06 : COMPETITION_OPERATIONS.REMNDR_04
  }
}

// MODEL_NO가 존재하는 오퍼레이션 — 나머지(REMNDR_04, OPT)는 houseTypeKey로 폴백한다(§4.4).
const OPERATIONS_WITH_MODEL_NO = new Set<string>([
  COMPETITION_OPERATIONS.APT,
  COMPETITION_OPERATIONS.URBTY_OFCTL,
  COMPETITION_OPERATIONS.PBL_PVT_RENT,
  COMPETITION_OPERATIONS.REMNDR_06,
])

function joinKeyOf(raw: Record<string, unknown>, preferModelNo: boolean): { key: string; modelNo: string | null } {
  const modelNo = raw.MODEL_NO != null && String(raw.MODEL_NO).trim() !== '' ? String(raw.MODEL_NO) : null
  if (preferModelNo && modelNo !== null) return { key: `model:${modelNo}`, modelNo }
  const houseType = typeof raw.HOUSE_TY === 'string' ? raw.HOUSE_TY : ''
  return { key: `type:${normalizeHouseType(houseType)}`, modelNo: null }
}

// RESIDE_SECD(코드) → ReceiptArea. 표시용 RESIDE_SENM은 API가 표기를 바꿔도 로직이
// 안 깨지게, 비교는 이 코드값에서 도출한 resideKind로만 한다(§4.1의 ReceiptArea 재사용).
const RESIDE_SECD_TO_KIND: Record<string, ReceiptArea> = {
  '01': 'corresponding',
  '02': 'etcArea',
  '03': 'etcGyeonggi',
}

function toCompetitionRow(raw: Record<string, unknown>): CompetitionRow {
  const { rate, rateRaw } = parseCompetitionRate(raw.CMPET_RATE)
  const resideArea =
    (typeof raw.RESIDE_SENM === 'string' ? raw.RESIDE_SENM : null) ??
    (typeof raw.RESIDNT_PRIOR_SENM === 'string' ? raw.RESIDNT_PRIOR_SENM : null) ??
    (typeof raw.SPSPLY_KND_NM === 'string' ? raw.SPSPLY_KND_NM : null)
  const resideKind = typeof raw.RESIDE_SECD === 'string' ? RESIDE_SECD_TO_KIND[raw.RESIDE_SECD] ?? null : null
  return {
    rankCode: parseCount(raw.SUBSCRPT_RANK_CODE),
    resideKind,
    resideArea,
    units: parseCount(raw.SUPLY_HSHLDCO),
    requestCount: parseCount(raw.REQ_CNT),
    rate,
    rateRaw,
  }
}

// 취소후재공급(getCancResplLttotPblancCmpet)은 한 행에 유형별 접두어 열이 나란히 온다(API-FIELDS B-4)
// — 다른 오퍼레이션처럼 행이 순위·유형별로 나뉘어 있지 않다. 접두어별로 쪼개 CompetitionRow로 만든다.
const CANC_RESPL_CATEGORIES: { prefix: string; label: string }[] = [
  { prefix: 'NORMAL', label: '일반공급' },
  { prefix: 'MNYCH', label: '다자녀' },
  { prefix: 'NWWDS', label: '신혼부부' },
  { prefix: 'LFE_FRST', label: '생애최초' },
  { prefix: 'OLD_PARNTS_SUPORT', label: '노부모부양' },
  { prefix: 'INSTT_RECOMEND', label: '기관추천' },
]

function toCancResplRows(raw: Record<string, unknown>): CompetitionRow[] {
  return CANC_RESPL_CATEGORIES.flatMap(({ prefix, label }) => {
    const requestCount = parseCount(raw[`${prefix}_REQ_CNT`])
    const rateValue = raw[`${prefix}_CMPET_RATE`]
    if (requestCount === null && rateValue == null) return []
    const { rate, rateRaw } = parseCompetitionRate(rateValue)
    return [
      { rankCode: null, resideKind: null, resideArea: label, units: parseCount(raw[`${prefix}_HSHLDCO`]), requestCount, rate, rateRaw },
    ]
  })
}

/**
 * raw 경쟁률 행을 모델(또는 주택형 키) 단위로 묶는다. 순수 함수라 단위 테스트 대상이다(팀 리드 승인).
 * `MODEL_NO`가 있는 오퍼레이션은 그걸로, 없으면(`getRemndrLttotPblancCmpet`/`getOPTLttotPblancCmpet`)
 * `houseTypeKey`로 폴백한다(§4.4). 조인 실패는 에러가 아니라 그 모델의 경쟁률 열이 비는 것으로 끝난다.
 */
export function groupCompetitionRows(rawRows: Record<string, unknown>[], operation: string): CompetitionSupplyRow[] {
  const preferModelNo = OPERATIONS_WITH_MODEL_NO.has(operation)
  const isCancRespl = operation === COMPETITION_OPERATIONS.REMNDR_06
  const groups = new Map<string, CompetitionSupplyRow>()

  for (const raw of rawRows) {
    const { key, modelNo } = joinKeyOf(raw, preferModelNo)
    const houseType = typeof raw.HOUSE_TY === 'string' ? raw.HOUSE_TY : ''
    const rows = isCancRespl ? toCancResplRows(raw) : [toCompetitionRow(raw)]
    if (rows.length === 0) continue

    const group = groups.get(key) ?? { modelNo, houseType, houseTypeKey: normalizeHouseType(houseType), competition: [] }
    group.competition.push(...rows)
    groups.set(key, group)
  }

  return Array.from(groups.values())
}

// 배정세대수 필드 — 유형코드 접두어가 접수건수 필드와 다르다(API-FIELDS B-8).
const SPECIAL_SUPPLY_TYPES: { code: string; label: string; hshldcoField: string }[] = [
  { code: 'MNYCH', label: '다자녀', hshldcoField: 'MNYCH_HSHLDCO' },
  { code: 'NWWDS_NMTW', label: '신혼부부', hshldcoField: 'NWWDS_NMTW_HSHLDCO' },
  { code: 'LFE_FRST', label: '생애최초', hshldcoField: 'LFE_FRST_HSHLDCO' },
  { code: 'YGMN', label: '청년', hshldcoField: 'YGMN_HSHLDCO' },
  { code: 'OPS', label: '노부모부양', hshldcoField: 'OLD_PARNTS_SUPORT_HSHLDCO' },
  { code: 'NWBB_NWBBSHR', label: '신생아', hshldcoField: 'NWBB_NWBBSHR_HSHLDCO' },
]

const SPECIAL_SUPPLY_AREA_PREFIXES: { prefix: string; label: string }[] = [
  { prefix: 'CRSPAREA', label: '해당' },
  { prefix: 'CTPRVN', label: '기타경기' },
  { prefix: 'ETC_AREA', label: '기타' },
]

function toSpecialSupplyByType(raw: Record<string, unknown>): SpecialSupplyByType[] {
  const byArea = SPECIAL_SUPPLY_TYPES.map(({ code, label, hshldcoField }) => ({
    label,
    units: parseCount(raw[hshldcoField]),
    requestCounts: SPECIAL_SUPPLY_AREA_PREFIXES.map(({ prefix, label: areaLabel }) => ({
      area: areaLabel,
      count: parseCount(raw[`${prefix}_${code}_CNT`]),
    })),
  }))

  // 기관추천·이전기관은 거주지역 축이 없고 필드명 규칙도 다르다(API-FIELDS B-8 예외).
  const institution: SpecialSupplyByType = {
    label: '기관추천',
    units: parseCount(raw.INSTT_RECOMEND_HSHLDCO),
    requestCounts: [
      { area: '당첨결정', count: parseCount(raw.INSTT_RECOMEND_DCSN_CNT) },
      { area: '예비자', count: parseCount(raw.INSTT_RECOMEND_PREPAR_CNT) },
    ],
  }
  const transfer: SpecialSupplyByType = {
    label: '이전기관',
    units: parseCount(raw.TRANSR_INSTT_ENFSN_HSHLDCO),
    requestCounts: [{ area: '접수', count: parseCount(raw.TRANSR_INSTT_ENFSN_CNT) }],
  }

  return [...byArea, institution, transfer].filter(
    (row) => row.units !== null || row.requestCounts.some((r) => r.count !== null),
  )
}

/**
 * 경쟁률·특별공급·당첨가점을 함께 조회해 조인한다. 하나가 실패해도 나머지로 응답한다(§4.2/§5).
 * `assertOdcloudKey()`를 직접 부르지 않는다 — `fetchOdcloudAll`이 픽스처 분기를 상류 진입 전에
 * 이미 가로채므로, 여기서 또 부르면 픽스처 모드에서 `Authorization: Infuser fixture`가
 * 실제로 상류에 나가는 함정에 빠진다(§11).
 */
export async function fetchCompetitionResult(notice: Notice, revalidate: number): Promise<CompetitionResult | null> {
  const operation = competitionOperationFor(notice.type, notice.houseSecd)
  const cond = { 'HOUSE_MANAGE_NO::EQ': notice.houseManageNo, 'PBLANC_NO::EQ': notice.id }
  const isApt = notice.type === 'APT'

  const [competitionResult, scoreResult, specialSupplyResult] = await Promise.allSettled([
    fetchOdcloudAll<Record<string, unknown>>(APPLYHOME_CMPET_BASE, operation, { cond, revalidate, perPage: 100 }),
    isApt
      ? fetchOdcloudAll<Record<string, unknown>>(APPLYHOME_CMPET_BASE, COMPETITION_OPERATIONS.APT_SCORE, { cond, revalidate, perPage: 100 })
      : Promise.resolve([]),
    isApt
      ? fetchOdcloudAll<Record<string, unknown>>(APPLYHOME_CMPET_BASE, COMPETITION_OPERATIONS.APT_SPECIAL_SUPPLY, { cond, revalidate, perPage: 100 })
      : Promise.resolve([]),
  ])

  const competitionRows = competitionResult.status === 'fulfilled' ? competitionResult.value : []
  const scoreRows = scoreResult.status === 'fulfilled' ? scoreResult.value : []
  const specialSupplyRows = specialSupplyResult.status === 'fulfilled' ? specialSupplyResult.value : []

  const preferModelNo = OPERATIONS_WITH_MODEL_NO.has(operation)
  const grouped = groupCompetitionRows(competitionRows, operation)

  const scoreByKey = new Map<string, WinnerScore>()
  for (const raw of scoreRows) {
    const { key } = joinKeyOf(raw, true) // B-7(당첨가점)은 항상 MODEL_NO를 갖는다
    scoreByKey.set(key, {
      lowest: parseAmount(raw.LWET_SCORE),
      highest: parseAmount(raw.TOP_SCORE),
      average: parseAmount(raw.AVRG_SCORE),
    })
  }

  const rows: CompetitionSupplyRow[] = grouped.map((group) => {
    const key = group.modelNo !== null && preferModelNo ? `model:${group.modelNo}` : `type:${normalizeHouseType(group.houseType)}`
    return { ...group, score: scoreByKey.get(key) }
  })

  const byType = isApt && specialSupplyRows.length > 0 ? toSpecialSupplyByType(specialSupplyRows[0]) : []
  const specialSupply: SpecialSupplyResult = { available: isApt, byType }

  // 경쟁률·특별공급 둘 다 비면 이 공고에 대해 보여줄 게 없다 — 204로 끝낸다(§5).
  if (rows.length === 0 && byType.length === 0) return null

  return { rows, specialSupply, joinedBy: preferModelNo ? 'modelNo' : 'houseTypeKey' }
}
