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
  apartmentRealTransactionIndex: 'A_2024_00178', // 공동주택 실거래가격지수 (월) — Phase 8 확인
} as const

export const REBSTAT_ITM_INDEX = 100001   // ITM_ID: "지수"
export const REBSTAT_CYCLE_MONTHLY = 'MM' // DTACYCLE_CD

export type RebstatTableId = (typeof REBSTAT_TABLES)[keyof typeof REBSTAT_TABLES]

/**
 * `CLS_ID`(지역 코드)는 지역만으로 정해지지 않는다 — **통계표(STATBL_ID)마다 다른 코드
 * 체계를 쓴다**(Phase 8 실측, 두 소스 교차 검증). 매매·전세는 같은 코드를 쓰지만 실거래는
 * 다르다(예: 서울이 매매·전세는 500008, 실거래는 500007). 지역 하나로 전역 상수를 두면
 * 다음 통계표를 추가할 때 같은 버그가 재발하므로, 통계표 ID를 키로 하는 중첩 레코드로
 * 이 종속성을 타입에 그대로 드러낸다(§4.0).
 */
export const REBSTAT_REGION_CLS_ID: Record<RebstatTableId, Record<'전국' | Region, number>> = {
  [REBSTAT_TABLES.apartmentSalePriceIndex]: {
    전국: 500001, 서울: 500008, 경기: 500009, 인천: 500010, 부산: 500011, 대구: 500012,
    광주: 500013, 대전: 500014, 울산: 500015, 세종: 500016, 강원: 500017, 충북: 500018,
    충남: 500019, 전북: 500020, 전남: 500021, 경북: 500022, 경남: 500023, 제주: 500024,
  },
  [REBSTAT_TABLES.apartmentJeonsePriceIndex]: {
    전국: 500001, 서울: 500008, 경기: 500009, 인천: 500010, 부산: 500011, 대구: 500012,
    광주: 500013, 대전: 500014, 울산: 500015, 세종: 500016, 강원: 500017, 충북: 500018,
    충남: 500019, 전북: 500020, 전남: 500021, 경북: 500022, 경남: 500023, 제주: 500024,
  },
  [REBSTAT_TABLES.apartmentRealTransactionIndex]: {
    전국: 500001, 서울: 500007, 경기: 500015, 인천: 500010, 부산: 500008, 대구: 500009,
    광주: 500011, 대전: 500012, 울산: 500013, 세종: 500014, 강원: 500016, 충북: 500017,
    충남: 500018, 전북: 500019, 전남: 500020, 경북: 500021, 경남: 500022, 제주: 500023,
  },
}
