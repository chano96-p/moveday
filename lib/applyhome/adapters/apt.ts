import type { Notice, ReceiptWindow, SupplyRow } from '@/lib/types'
import type { NoticeAdapter, RegulationInfo } from './index'
import { normalizeRegion } from '@/lib/region'
import {
  computeReceiptBounds,
  toHouseTypeKey,
  parseAmount,
  parseCount,
  parseIsoDate,
} from '@/lib/applyhome/parse'

interface AptDetailRaw {
  HOUSE_MANAGE_NO: string
  PBLANC_NO: string
  HOUSE_NM: string
  HOUSE_SECD?: string | null
  SUBSCRPT_AREA_CODE_NM?: string | null
  HSSPLY_ADRES?: string | null
  TOT_SUPLY_HSHLDCO?: number | string | null
  RCRIT_PBLANC_DE?: string | null
  RCEPT_BGNDE?: string | null
  RCEPT_ENDDE?: string | null
  SPSPLY_RCEPT_BGNDE?: string | null
  SPSPLY_RCEPT_ENDDE?: string | null
  GNRL_RNK1_CRSPAREA_RCPTDE?: string | null
  GNRL_RNK1_CRSPAREA_ENDDE?: string | null
  GNRL_RNK1_ETC_GG_RCPTDE?: string | null
  GNRL_RNK1_ETC_GG_ENDDE?: string | null
  GNRL_RNK1_ETC_AREA_RCPTDE?: string | null
  GNRL_RNK1_ETC_AREA_ENDDE?: string | null
  GNRL_RNK2_CRSPAREA_RCPTDE?: string | null
  GNRL_RNK2_CRSPAREA_ENDDE?: string | null
  GNRL_RNK2_ETC_GG_RCPTDE?: string | null
  GNRL_RNK2_ETC_GG_ENDDE?: string | null
  GNRL_RNK2_ETC_AREA_RCPTDE?: string | null
  GNRL_RNK2_ETC_AREA_ENDDE?: string | null
  PRZWNER_PRESNATN_DE?: string | null
  CNTRCT_CNCLS_BGNDE?: string | null
  CNTRCT_CNCLS_ENDDE?: string | null
  PBLANC_URL?: string | null
  SPECLT_RDN_EARTH_AT?: string | null
  MDAT_TRGET_AREA_SECD?: string | null
  PARCPRC_ULS_AT?: string | null
  IMPRMN_BSNS_AT?: string | null
  PUBLIC_HOUSE_EARTH_AT?: string | null
  LRSCL_BLDLND_AT?: string | null
  NPLN_PRVOPR_PUBLIC_HOUSE_AT?: string | null
  PUBLIC_HOUSE_SPCLW_APPLC_AT?: string | null
}

const REGULATION_FLAGS: { key: keyof AptDetailRaw; label: string }[] = [
  { key: 'SPECLT_RDN_EARTH_AT', label: '투기과열지구' },
  { key: 'MDAT_TRGET_AREA_SECD', label: '조정대상지역' },
  { key: 'PARCPRC_ULS_AT', label: '분양가상한제' },
  { key: 'IMPRMN_BSNS_AT', label: '정비사업' },
  { key: 'PUBLIC_HOUSE_EARTH_AT', label: '공공주택지구' },
  { key: 'LRSCL_BLDLND_AT', label: '대규모 택지개발지구' },
  { key: 'NPLN_PRVOPR_PUBLIC_HOUSE_AT', label: '수도권 내 민영 공공주택지구' },
  { key: 'PUBLIC_HOUSE_SPCLW_APPLC_AT', label: '공공주택 특별법 적용' },
]

interface AptMdlRaw {
  HOUSE_MANAGE_NO: string
  PBLANC_NO: string
  MODEL_NO: string
  HOUSE_TY: string
  SUPLY_AR?: number | string | null
  SUPLY_HSHLDCO?: number | string | null
  SPSPLY_HSHLDCO?: number | string | null
  LTTOT_TOP_AMOUNT?: string | number | null
  MNYCH_HSHLDCO?: number | string | null
  NWWDS_HSHLDCO?: number | string | null
  LFE_FRST_HSHLDCO?: number | string | null
  OLD_PARNTS_SUPORT_HSHLDCO?: number | string | null
  INSTT_RECOMEND_HSHLDCO?: number | string | null
  TRANSR_INSTT_ENFSN_HSHLDCO?: number | string | null
  YGMN_HSHLDCO?: number | string | null
  NWBB_HSHLDCO?: number | string | null
  ETC_HSHLDCO?: number | string | null
}

function buildReceipt(raw: AptDetailRaw): ReceiptWindow[] {
  const candidates: ReceiptWindow[] = [
    { kind: 'all', area: null, start: parseIsoDate(raw.RCEPT_BGNDE), end: parseIsoDate(raw.RCEPT_ENDDE) },
    { kind: 'special', area: null, start: parseIsoDate(raw.SPSPLY_RCEPT_BGNDE), end: parseIsoDate(raw.SPSPLY_RCEPT_ENDDE) },
    { kind: 'first', area: 'corresponding', start: parseIsoDate(raw.GNRL_RNK1_CRSPAREA_RCPTDE), end: parseIsoDate(raw.GNRL_RNK1_CRSPAREA_ENDDE) },
    { kind: 'first', area: 'etcGyeonggi', start: parseIsoDate(raw.GNRL_RNK1_ETC_GG_RCPTDE), end: parseIsoDate(raw.GNRL_RNK1_ETC_GG_ENDDE) },
    { kind: 'first', area: 'etcArea', start: parseIsoDate(raw.GNRL_RNK1_ETC_AREA_RCPTDE), end: parseIsoDate(raw.GNRL_RNK1_ETC_AREA_ENDDE) },
    { kind: 'second', area: 'corresponding', start: parseIsoDate(raw.GNRL_RNK2_CRSPAREA_RCPTDE), end: parseIsoDate(raw.GNRL_RNK2_CRSPAREA_ENDDE) },
    { kind: 'second', area: 'etcGyeonggi', start: parseIsoDate(raw.GNRL_RNK2_ETC_GG_RCPTDE), end: parseIsoDate(raw.GNRL_RNK2_ETC_GG_ENDDE) },
    { kind: 'second', area: 'etcArea', start: parseIsoDate(raw.GNRL_RNK2_ETC_AREA_RCPTDE), end: parseIsoDate(raw.GNRL_RNK2_ETC_AREA_ENDDE) },
  ]
  return candidates.filter((w) => w.start !== null || w.end !== null)
}

function toNotice(rawInput: unknown): Notice {
  const raw = rawInput as AptDetailRaw
  const receipt = buildReceipt(raw)
  const { start, end } = computeReceiptBounds(receipt)
  return {
    id: String(raw.PBLANC_NO),
    houseManageNo: String(raw.HOUSE_MANAGE_NO),
    type: 'APT',
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
  return (rawArray as AptMdlRaw[]).map((raw) => ({
    modelNo: String(raw.MODEL_NO),
    houseType: raw.HOUSE_TY,
    houseTypeKey: toHouseTypeKey(raw.HOUSE_TY),
    area: { value: parseAmount(raw.SUPLY_AR), kind: 'supply' },
    generalUnits: parseCount(raw.SUPLY_HSHLDCO),
    specialUnits: parseCount(raw.SPSPLY_HSHLDCO),
    specialBreakdown: {
      다자녀: parseCount(raw.MNYCH_HSHLDCO),
      신혼부부: parseCount(raw.NWWDS_HSHLDCO),
      생애최초: parseCount(raw.LFE_FRST_HSHLDCO),
      노부모부양: parseCount(raw.OLD_PARNTS_SUPORT_HSHLDCO),
      기관추천: parseCount(raw.INSTT_RECOMEND_HSHLDCO),
      이전기관: parseCount(raw.TRANSR_INSTT_ENFSN_HSHLDCO),
      청년: parseCount(raw.YGMN_HSHLDCO),
      신생아: parseCount(raw.NWBB_HSHLDCO),
      기타: parseCount(raw.ETC_HSHLDCO),
    },
    price: parseAmount(raw.LTTOT_TOP_AMOUNT),
  }))
}

function toRegulation(rawInput: unknown): RegulationInfo {
  const raw = rawInput as AptDetailRaw
  const flags = REGULATION_FLAGS.filter((flag) => raw[flag.key] === 'Y').map((flag) => ({ key: flag.key, label: flag.label }))
  return { available: true, flags }
}

export const aptAdapter: NoticeAdapter = {
  detailOperation: 'getAPTLttotPblancDetail',
  mdlOperation: 'getAPTLttotPblancMdl',
  dateFormat: 'iso',
  areaKind: 'supply',
  condFields: { noticeNo: 'PBLANC_NO', houseManageNo: 'HOUSE_MANAGE_NO', noticeDate: 'RCRIT_PBLANC_DE' },
  toNotice,
  toSupplyRows,
  toRegulation,
}
