import type { NoticeType, Region } from './types'

export const REGIONS = [
  '서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
] as const satisfies readonly Region[]

export const NOTICE_TYPES = ['APT', 'REMNDR', 'URBTY_OFCTL', 'PBL_PVT_RENT', 'OPT'] as const satisfies readonly NoticeType[]

export const NOTICE_TYPE_LABEL: Record<NoticeType, string> = {
  APT: 'APT',
  REMNDR: '무순위·잔여',
  URBTY_OFCTL: '오피스텔·도시형',
  PBL_PVT_RENT: '공공지원 민간임대',
  OPT: '임의공급',
}

export const DATE_FORMAT_BY_TYPE: Record<NoticeType, 'iso' | 'compact'> = {
  APT: 'iso',
  REMNDR: 'iso',
  URBTY_OFCTL: 'iso',
  PBL_PVT_RENT: 'compact',
  OPT: 'compact',
}

export const APPLYHOME_OPERATIONS: Record<NoticeType, { detail: string; mdl: string }> = {
  APT: { detail: 'getAPTLttotPblancDetail', mdl: 'getAPTLttotPblancMdl' },
  REMNDR: { detail: 'getRemndrLttotPblancDetail', mdl: 'getRemndrLttotPblancMdl' },
  URBTY_OFCTL: { detail: 'getUrbtyOfctlLttotPblancDetail', mdl: 'getUrbtyOfctlLttotPblancMdl' },
  PBL_PVT_RENT: { detail: 'getPblPvtRentLttotPblancDetail', mdl: 'getPblPvtRentLttotPblancMdl' },
  OPT: { detail: 'getOPTLttotPblancDetail', mdl: 'getOPTLttotPblancMdl' },
}

export const COMPETITION_OPERATIONS = {
  APT: 'getAPTLttotPblancCmpet',
  URBTY_OFCTL: 'getUrbtyOfctlLttotPblancCmpet',
  PBL_PVT_RENT: 'getPblPvtRentLttotPblancCmpet',
  REMNDR_04: 'getRemndrLttotPblancCmpet',
  REMNDR_06: 'getCancResplLttotPblancCmpet',
  OPT: 'getOPTLttotPblancCmpet',
  APT_SPECIAL_SUPPLY: 'getAPTSpsplyReqstStus',
  APT_SCORE: 'getAptLttotPblancScore',
} as const

export const CACHE_TTL = {
  noticeList: 600,      // 10분
  noticeDetail: 1800,   // 30분
  competition: 1800,    // 30분
  marketStats: 86400,   // 24시간
} as const

export const REBSTAT_TABLES = {
  apartmentSalePriceIndex: 'A_2024_00045',       // 아파트 매매가격지수 (월)
  apartmentJeonsePriceIndex: 'A_2024_00050',     // 아파트 전세가격지수 (월)
  apartmentRealTransactionIndex: null,           // TODO: 공동주택 실거래가격지수 — 미확인
} as const

export const REBSTAT_ITM_INDEX = 100001   // ITM_ID: "지수"
export const REBSTAT_CYCLE_MONTHLY = 'MM' // DTACYCLE_CD

export const REBSTAT_REGION_CLS_ID: Record<'전국' | Region, number | null> = {
  전국: 500001,   // 확인
  서울: null,     // TODO: 통계코드 검색 또는 인증키로 CLS_ID 조회
  경기: null,
  인천: null,
  부산: null,
  대구: null,
  광주: null,
  대전: null,
  울산: null,
  세종: null,
  강원: null,
  충북: null,
  충남: null,
  전북: null,
  전남: null,
  경북: null,
  경남: null,
  제주: null,
}
