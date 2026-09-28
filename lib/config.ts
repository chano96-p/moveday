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
  analysis: 86400,      // 24시간 — 무료 티어의 일일 호출 한도를 공고 단위로 아낀다(§13)
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

/**
 * Gemini Interactions API(§13). `generateContent`가 아니라 `/v1beta/interactions`다 —
 * 요청 본문이 `model`/`input`/`response_format`이고 결과는 `steps[]`로 온다.
 */
export const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/interactions'

/**
 * 분석문은 한국어 서술 + 고정 스키마 JSON이다. 둘을 동시에 요구하면 경량 모델이 한국어가
 * 어색해지거나 스키마를 어기므로 원래는 `gemini-3.8-flash`를 기본으로 뒀다.
 *
 * 실측(2026-09-28)에서 그 판단을 바꿨다. flash는 **무료 티어 분당 5회**이고 하루 내내
 * `503 "currently experiencing high demand"`로 거절했다 — 품질을 따지기 전에 응답 자체를
 * 못 받는다. `gemini-3.1-flash-lite`는 같은 프롬프트로 정상 응답했고 출력도 쓸 만했다.
 * **받아볼 수 없는 품질보다 받아지는 품질이 낫다**는 이유로 기본을 이쪽으로 둔다.
 *
 * flash가 한가해지면 `GEMINI_MODEL=gemini-3.8-flash`로 덮어쓰면 된다 — 코드 수정 없이.
 * 클라이언트 번들에서는 이 값이 읽히지 않아 항상 기본값으로 떨어지지만, 실제 호출은
 * 서버에서만 일어나고 응답이 쓴 모델명을 실어 보내므로 화면 표기는 어긋나지 않는다.
 */
export const GEMINI_MODEL = resolveModel(process.env.GEMINI_MODEL)

/**
 * **빈 문자열을 "설정 안 함"으로 본다.** `?? `로 받으면 `GEMINI_MODEL=`(값 없는 줄)이
 * 기본값을 덮어써 모델명 `''`로 호출이 나가고, 상류가 `Model '' not found`(404)를 낸다.
 * `.env.example`을 그대로 복사하면 항상 그 상태가 되므로 여기서 접는다.
 */
export function resolveModel(value: string | undefined): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : 'gemini-3.1-flash-lite'
}
