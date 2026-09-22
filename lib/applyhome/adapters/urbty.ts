import type { Notice, ReceiptWindow, SupplyRow } from '@/lib/types'
import type { NoticeAdapter } from './index'
import { normalizeRegion } from '@/lib/region'
import {
  computeReceiptBounds,
  normalizeHouseType,
  parseAmount,
  parseCount,
  parseIsoDate,
} from '@/lib/applyhome/parse'

interface UrbtyDetailRaw {
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

interface UrbtyMdlRaw {
  HOUSE_MANAGE_NO: string
  PBLANC_NO: string
  MODEL_NO: string
  GP: string
  TP: string
  EXCLUSE_AR?: number | string | null
  SUPLY_HSHLDCO?: number | string | null
  SUPLY_AMOUNT?: string | number | null
}

function buildReceipt(raw: UrbtyDetailRaw): ReceiptWindow[] {
  const candidates: ReceiptWindow[] = [
    { kind: 'all', area: null, start: parseIsoDate(raw.SUBSCRPT_RCEPT_BGNDE), end: parseIsoDate(raw.SUBSCRPT_RCEPT_ENDDE) },
  ]
  return candidates.filter((w) => w.start !== null || w.end !== null)
}

function toNotice(rawInput: unknown): Notice {
  const raw = rawInput as UrbtyDetailRaw
  const receipt = buildReceipt(raw)
  const { start, end } = computeReceiptBounds(receipt)
  return {
    id: String(raw.PBLANC_NO),
    houseManageNo: String(raw.HOUSE_MANAGE_NO),
    type: 'URBTY_OFCTL',
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
  return (rawArray as UrbtyMdlRaw[]).map((raw) => ({
    modelNo: String(raw.MODEL_NO),
    houseType: [raw.GP, raw.TP].filter(Boolean).join(' '),
    houseTypeKey: normalizeHouseType(raw.TP),
    area: { value: parseAmount(raw.EXCLUSE_AR), kind: 'exclusive' },
    generalUnits: parseCount(raw.SUPLY_HSHLDCO),
    specialUnits: null,
    specialBreakdown: null,
    price: parseAmount(raw.SUPLY_AMOUNT),
  }))
}

function toRegulation() {
  return { available: false, flags: [] }
}

export const urbtyAdapter: NoticeAdapter = {
  detailOperation: 'getUrbtyOfctlLttotPblancDetail',
  mdlOperation: 'getUrbtyOfctlLttotPblancMdl',
  dateFormat: 'iso',
  areaKind: 'exclusive',
  condFields: { noticeNo: 'PBLANC_NO', houseManageNo: 'HOUSE_MANAGE_NO', noticeDate: 'RCRIT_PBLANC_DE' },
  toNotice,
  toSupplyRows,
  toRegulation,
}
