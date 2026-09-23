import type { Notice, ReceiptWindow, SupplyRow } from '@/lib/types'
import type { NoticeAdapter } from './index'
import { normalizeRegion } from '@/lib/region'
import {
  computeReceiptBounds,
  isMeaningfulValue,
  parseAmount,
  parseCount,
  parseIsoDate,
  toHouseTypeKey,
} from '@/lib/applyhome/parse'

interface RentDetailRaw {
  HOUSE_MANAGE_NO: string
  PBLANC_NO: string
  HOUSE_NM: string
  HOUSE_SECD?: string | null
  SUBSCRPT_AREA_CODE_NM?: string | null
  HSSPLY_ADRES?: string | null
  TOT_SUPLY_HSHLDCO?: number | string | null
  RCRIT_PBLANC_DE?: string | null
  SUBSCRPT_RCEPT_BGNDE?: string | null
  SUBSCRPT_RCEPT_ENDDE?: string | null
  PRZWNER_PRESNATN_DE?: string | null
  CNTRCT_CNCLS_BGNDE?: string | null
  CNTRCT_CNCLS_ENDDE?: string | null
  PBLANC_URL?: string | null
}

interface RentMdlRaw {
  HOUSE_MANAGE_NO: string
  PBLANC_NO: string
  MODEL_NO: string
  GP: string
  TP: string
  EXCLUSE_AR?: number | string | null
  GNSPLY_HSHLDCO?: number | string | null
  SPSPLY_YGMN_HSHLDCO?: number | string | null
  SPSPLY_NEW_MRRG_HSHLDCO?: number | string | null
  SPSPLY_AGED_HSHLDCO?: number | string | null
  SUPLY_AMOUNT?: string | number | null
}

function buildReceipt(raw: RentDetailRaw): ReceiptWindow[] {
  const candidates: ReceiptWindow[] = [
    { kind: 'all', area: null, start: parseIsoDate(raw.SUBSCRPT_RCEPT_BGNDE), end: parseIsoDate(raw.SUBSCRPT_RCEPT_ENDDE) },
  ]
  return candidates.filter((w) => w.start !== null || w.end !== null)
}

function toNotice(rawInput: unknown): Notice {
  const raw = rawInput as RentDetailRaw
  const receipt = buildReceipt(raw)
  const { start, end } = computeReceiptBounds(receipt)
  return {
    id: String(raw.PBLANC_NO),
    houseManageNo: String(raw.HOUSE_MANAGE_NO),
    type: 'PBL_PVT_RENT',
    houseSecd: raw.HOUSE_SECD ?? null,
    houseName: raw.HOUSE_NM,
    region: normalizeRegion(raw.SUBSCRPT_AREA_CODE_NM),
    address: raw.HSSPLY_ADRES ?? null,
    noticeDate: parseIsoDate(raw.RCRIT_PBLANC_DE),
    receipt,
    receiptStart: start,
    receiptEnd: end,
    winnerDate: parseIsoDate(raw.PRZWNER_PRESNATN_DE),
    contractStart: parseIsoDate(raw.CNTRCT_CNCLS_BGNDE),
    contractEnd: parseIsoDate(raw.CNTRCT_CNCLS_ENDDE),
    minPrice: null,
    maxPrice: null,
    totalUnits: parseCount(raw.TOT_SUPLY_HSHLDCO),
    noticeUrl: raw.PBLANC_URL ?? null,
  }
}

function toSupplyRows(rawArray: unknown[]): SupplyRow[] {
  return (rawArray as RentMdlRaw[]).map((raw) => {
    const 청년 = parseCount(raw.SPSPLY_YGMN_HSHLDCO)
    const 신혼 = parseCount(raw.SPSPLY_NEW_MRRG_HSHLDCO)
    const 고령자 = parseCount(raw.SPSPLY_AGED_HSHLDCO)
    const specialParts = [청년, 신혼, 고령자].filter((v): v is number => v !== null)
    return {
      modelNo: String(raw.MODEL_NO),
      // GP(군)가 없으면 빈 문자열이 아니라 "-"로 온다(Phase 8 실측, PBL_PVT_RENT 100%) —
      // 걸러내지 않으면 "- 59A-1"처럼 자리표시자가 그대로 샌다.
      houseType: [raw.GP, raw.TP].filter(isMeaningfulValue).join(' '),
      houseTypeKey: toHouseTypeKey(raw.TP),
      area: { value: parseAmount(raw.EXCLUSE_AR), kind: 'exclusive' },
      generalUnits: parseCount(raw.GNSPLY_HSHLDCO),
      specialUnits: specialParts.length ? specialParts.reduce((a, b) => a + b, 0) : null,
      specialBreakdown: { 청년, 신혼, 고령자 },
      price: parseAmount(raw.SUPLY_AMOUNT),
    }
  })
}

function toRegulation() {
  return { available: false, flags: [] }
}

export const rentAdapter: NoticeAdapter = {
  detailOperation: 'getPblPvtRentLttotPblancDetail',
  mdlOperation: 'getPblPvtRentLttotPblancMdl',
  dateFormat: 'compact',
  areaKind: 'exclusive',
  condFields: { noticeNo: 'PBLANC_NO', houseManageNo: 'HOUSE_MANAGE_NO', noticeDate: 'RCRIT_PBLANC_DE' },
  toNotice,
  toSupplyRows,
  toRegulation,
}
