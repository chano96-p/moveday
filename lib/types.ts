export type NoticeType = 'APT' | 'REMNDR' | 'URBTY_OFCTL' | 'PBL_PVT_RENT' | 'OPT'

export type Region =
  | '서울' | '경기' | '인천' | '부산' | '대구' | '광주' | '대전' | '울산' | '세종'
  | '강원' | '충북' | '충남' | '전북' | '전남' | '경북' | '경남' | '제주'

export type ReceiptKind = 'all' | 'special' | 'general' | 'first' | 'second'
export type ReceiptArea = 'corresponding' | 'etcGyeonggi' | 'etcArea'

export interface ReceiptWindow {
  kind: ReceiptKind
  area: ReceiptArea | null      // APT 1·2순위만 세분화, 나머지는 null
  start: string | null          // ISO yyyy-MM-dd
  end: string | null
}

export interface Notice {
  id: string                    // PBLANC_NO
  houseManageNo: string         // HOUSE_MANAGE_NO — Mdl·경쟁률 조인에 필요
  type: NoticeType
  houseSecd: string | null      // 경쟁률 오퍼레이션 분기용
  houseName: string
  region: Region | null
  address: string | null
  noticeDate: string | null
  receipt: ReceiptWindow[]      // 유형별로 개수가 다르다
  receiptStart: string | null   // min(receipt[].start)
  receiptEnd: string | null     // max(receipt[].end)
  winnerDate: string | null
  contractStart: string | null
  contractEnd: string | null
  minPrice: number | null       // 만원
  maxPrice: number | null       // 만원
  totalUnits: number | null
  noticeUrl: string | null
}

// 목록 응답 전용 타입. 분양가는 Detail에 없고 Mdl에만 있어 목록에서는 항상 null이라(§4.1),
// `number | null`로 두면 화면이 "값이 올 수도 있다"로 읽는다 → 필드 자체를 뺀다.
export type NoticeListItem = Omit<Notice, 'minPrice' | 'maxPrice'>

export interface SupplyRow {
  modelNo: string
  houseType: string             // 원문 표기 그대로 (화면 표시용)
  houseTypeKey: string          // 정규화 조인 키 (폴백용)
  area: { value: number | null; kind: 'exclusive' | 'supply' }
  generalUnits: number | null
  specialUnits: number | null
  specialBreakdown: Record<string, number | null> | null
  price: number | null          // 만원
  competition?: CompetitionRow  // 조인 성공 시에만
  score?: WinnerScore           // APT + 데이터 있을 때만
}

export interface CompetitionRow {
  rankCode: number | null       // SUBSCRPT_RANK_CODE
  resideKind: ReceiptArea | null // RESIDE_SECD에서 도출 — 로직 판정용(표시 문자열에 의존하지 않는다)
  resideArea: string | null     // RESIDE_SENM — 표시용
  units: number | null
  requestCount: number | null
  rate: number | null           // 숫자 파싱 성공 시
  rateRaw: string               // 원문 ("△" 등 비수치 값 보존)
}

export interface WinnerScore {
  lowest: number | null
  highest: number | null
  average: number | null
}

export interface MarketSeries {
  key: 'sale' | 'jeonse' | 'realTransaction'
  label: string
  points: { month: string; value: number }[]   // month = 'yyyy-MM'
  change: { mom: number | null; yoy: number | null }
}
