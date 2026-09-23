# moveday 설계

아파트 청약 공고를 **"언제 이사 갈 수 있는가"** 관점으로 보여주는 대시보드.

- 작성: 2026-09-22
- 상태: 구현 착수 전 설계 확정본
- 필드 매핑 원본은 [API-FIELDS.md](./API-FIELDS.md) 참조

---

## 1. 개요와 범위

### 하는 일

청약홈 분양정보 · 접수 경쟁률 · 한국부동산원 부동산통계를 한 화면에 모아,
어떤 공고가 지금 접수 중이고 언제 마감되며 분양가가 그 지역 시세 흐름 대비 어느 수준인지 판단하게 한다.

### 구조 결정: 단일 Next.js 앱

Next.js 15 App Router 단일 앱(TypeScript, pnpm). `app/api/*` Route Handler가 백엔드 역할을 한다.
별도 Python 백엔드를 두지 않는다 — 서버가 할 일이 **인증키 숨기기 / 프록시 / 캐시 / 정규화**뿐이라
Route Handler로 충분하고, 언어·서버·배포를 하나로 유지하는 이득이 크다.

### 이번 범위 (Phase 1~7)

정규화 계층, 6개 API 엔드포인트, Dashboard, NoticeDetail, 경쟁률·당첨가점 연동,
부동산통계 차트, 가점 계산기, 카카오 지도.

### 제외 (확장 과제)

AI 분석, 알림(텔레그램/슬랙), 실거래가 개별 거래 조회, 스케줄 수집·DB 적재.

### 이 설계의 전제: 인증키가 아직 없다

세 소스의 인증키를 아직 발급받지 않았다. 그래서 설계의 중심은
**키가 없어도 정규화·테스트·UI를 완성할 수 있는 구조**다.

- raw 응답 → `Notice` 타입 **어댑터 함수**로 분리한다.
- **화면 코드는 raw 필드를 절대 직접 참조하지 않는다.**
- 응답 샘플을 `test/fixtures/{applyhome,competition,rebstat}/*.json` 픽스처로 저장해 개발한다.
- 키를 받으면(Phase 8) 픽스처를 실제 응답으로 교체하고 테스트를 돌려 필드 차이를 드러내고,
  **어댑터만** 수정한다.

### 용어 규칙

도메인 용어는 `notice` / `receipt` / `winner` / `supply` / `score` 로 통일한다.
로마자 음차는 코드·UI 어디에도 쓰지 않는다.

---

## 2. 기술 스택과 폴더 구조

### 의존성

| 패키지 | 용도 |
|---|---|
| `@tanstack/react-query` | 클라이언트 데이터 페칭, 10분 자동 갱신 |
| `zod` | Route Handler 쿼리 파라미터 검증 |
| `date-fns` | 날짜 파싱·비교·D-day 계산 |
| `recharts` | 지수 시계열 라인 차트 |
| `fast-xml-parser` | R-ONE xml 폴백 파싱 |
| `vitest` | 단위 테스트 |
| `tailwindcss` (v4) | 스타일링 |

### 폴더 구조

```
app/
  layout.tsx                        전역 헤더(로고 · /score 링크)
  page.tsx                          Dashboard
  providers.tsx                     react-query QueryClientProvider
  globals.css                       Tailwind v4 + @theme 토큰
  notices/[id]/page.tsx             NoticeDetail
  score/page.tsx                    가점 계산기 (입력 폼)
  api/
    health/route.ts
    notices/route.ts
    notices/[id]/route.ts
    notices/[id]/competition/route.ts
    market/price-index/route.ts
    market/real-transaction/route.ts

lib/
  config.ts                         지역·유형·오퍼레이션·통계코드·캐시 TTL 상수
  types.ts                          Notice / SupplyRow / CompetitionRow / MarketSeries
  cache.ts                          cached() + dedupe()
  dday.ts                           D-day·status 계산 (요청 시각 기준)
  region.ts                         지역 정규화 + R-ONE 매핑
  format.ts                         금액 축약·면적·D-day·변동률 표시
  score.ts                          가점 계산 (순수 함수)
  errors.ts                         KeyMissingError / SampleResponseError 등
  applyhome/
    client.ts                       odcloud 호출 + 키 검사 + 부분 실패
    parse.ts                        parseIsoDate / parseAmount / parseCount
                                    / normalizeHouseType / parseCompetitionRate
    adapters/apt.ts
    adapters/remndr.ts
    adapters/urbty.ts
    adapters/rent.ts
    adapters/opt.ts
    adapters/index.ts               유형 → 오퍼레이션·어댑터 레지스트리
    competition.ts                  경쟁률·당첨가점 조회 (서버 전용)
    competitionJoin.ts              SupplyRow 조인 (순수 함수, 클라이언트 import 가능)
  rebstat/
    client.ts                       R-ONE 호출 + json→xml 폴백 + sample 감지
    adapter.ts                      row → MarketSeries + mom/yoy 계산

components/
  SummaryBar.tsx        DeadlineCards.tsx    NoticeTable.tsx
  TypeTabs.tsx          RegionFilter.tsx     DdayBadge.tsx
  FavoriteStar.tsx      MarketStrip.tsx      IndexChart.tsx
  NoticeHeader.tsx      ScheduleTimeline.tsx SupplyTable.tsx
  SpecialSupplyBox.tsx  RegulationBox.tsx    RegionMarket.tsx
  KakaoMap.tsx          AISection.tsx        ScoreBadge.tsx

hooks/
  useFavorites.ts                   localStorage, SSR 안전
  useScore.ts                       localStorage, SSR 안전

test/
  fixtures/applyhome/*.json
  fixtures/competition/*.json
  fixtures/rebstat/*.json
  parse.test.ts  dday.test.ts  region.test.ts
  adapters.test.ts  rebstat-sample.test.ts
```

### 2.1 개발용 픽스처 모드

인증키를 받기 전에는 `/api/notices`가 503이라 **브라우저로 화면을 볼 수 없다.**
설계가 "각 Phase 끝에서 브라우저로 확인"을 요구하므로 개발용 경로를 둔다.

```bash
MOVEDAY_USE_FIXTURES=1 pnpm dev
```

- **기본 비활성.** 변수가 없으면 상류를 호출하고, 키가 없으면 503이다.
- 서버 전용. `NEXT_PUBLIC_` 접두어를 쓰지 않는다.
- `lib/applyhome/fixtures.ts`가 `test/fixtures/applyhome/*.json`을 읽어 반환한다.
- **날짜를 오늘 기준으로 시프트한다** — 픽스처 캡처 기준일(2026-09-22)부터 오늘까지의
  일수만큼 민다. 언제 띄워도 `upcoming`/`open`/`closed`가 재현된다.
  시프트는 메모리에서만 일어나고 파일은 건드리지 않는다.
- `test/fixtures/applyhome/` 10개는 **Phase 8에서 실제 응답으로 교체할 대조군이라 수정 금지**다.
  상태 재현용 추가 픽스처는 `test/fixtures/dev/`에 둔다.

> ⚠️ **8자리 문자열을 날짜로 오인하지 마라.** `MDHS_TELNO`(문의처)의 `"16001004"`가
> `/^\d{8}$/`에 걸려 `1600-10-04`로 파싱되는 사고가 실제로 있었다. 연도 범위로 걸러낸다.
> `shiftDateString`은 순수 함수이므로 **§4.6 테스트 범위의 예외로 회귀 케이스 2건**을 둔다
> (`"16001004"` 불변 / `"20260813"` 시프트).

---

## 3. 데이터 소스 3종

규격과 인증키가 서로 다르므로 클라이언트를 분리한다.

| | (A) 분양정보 | (B) 경쟁률·특별공급 | (C) 부동산통계 |
|---|---|---|---|
| 포털 ID | data.go.kr 15098547 | data.go.kr 15098905 | R-ONE (15134761) |
| base URL | `https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1` | `https://api.odcloud.kr/api/ApplyhomeInfoCmpetRtSvc/v1` | `https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do` |
| 인증 | `Authorization: Infuser {key}` 헤더 (`serviceKey` 쿼리도 가능) | 동일 | `KEY` 쿼리 |
| 페이징 | `page` / `perPage` | 동일 | `pIndex` / `pSize` |
| 필터 | `cond[FIELD::연산자]` | 동일 | `STATBL_ID` / `CLS_ID` / `ITM_ID` / `DTACYCLE_CD` |
| 응답 | JSON (`data[]` + `totalCount`) | 동일 | JSON 또는 XML (`Type` 지정) |
| 환경변수 | `ODCLOUD_SERVICE_KEY` | 동일 (계정 공용) | `REB_STAT_API_KEY` |

**(A)와 (B)는 파라미터 문법이 같고 base URL만 다르다** → 클라이언트 코드를 공유하고 base URL만 주입한다.
활용신청은 별개지만 인증키는 계정 공용이므로 환경변수 하나를 둘 다에 쓴다.

**(C)는 규격이 완전히 다르다** → 별도 클라이언트.

### 오퍼레이션

**(A) 분양정보** — 5개 유형 × Detail/Mdl = 10개

| `NoticeType` | 화면 표기 | Detail | Mdl (주택형별) |
|---|---|---|---|
| `APT` | APT | `getAPTLttotPblancDetail` | `getAPTLttotPblancMdl` |
| `REMNDR` | 무순위·잔여 | `getRemndrLttotPblancDetail` | `getRemndrLttotPblancMdl` |
| `URBTY_OFCTL` | 오피스텔·도시형 | `getUrbtyOfctlLttotPblancDetail` | `getUrbtyOfctlLttotPblancMdl` |
| `PBL_PVT_RENT` | 공공지원 민간임대 | `getPblPvtRentLttotPblancDetail` | `getPblPvtRentLttotPblancMdl` |
| `OPT` | 임의공급 | `getOPTLttotPblancDetail` | `getOPTLttotPblancMdl` |

임의공급 오퍼레이션명은 `OPT` 접두어로 확정됐다(공식 OAS 스펙에서 확인).

**(B) 경쟁률·특별공급** — 8개

| 오퍼레이션 | 용도 | 대응 유형 |
|---|---|---|
| `getAPTLttotPblancCmpet` | 주택형별 경쟁률 | `APT` |
| `getUrbtyOfctlLttotPblancCmpet` | 주택형별 경쟁률 | `URBTY_OFCTL` |
| `getPblPvtRentLttotPblancCmpet` | 주택형별 경쟁률 | `PBL_PVT_RENT` |
| `getRemndrLttotPblancCmpet` | 잔여세대 경쟁률 | `REMNDR` (`HOUSE_SECD`=04) |
| `getCancResplLttotPblancCmpet` | 취소후재공급 경쟁률 | `REMNDR` (`HOUSE_SECD`=06) |
| `getOPTLttotPblancCmpet` | 주택형별 경쟁률 | `OPT` |
| `getAPTSpsplyReqstStus` | 특별공급 신청현황 | `APT` 전용 |
| `getAptLttotPblancScore` | 당첨가점 최저·최고·평균 | `APT` 전용 |

`REMNDR`은 Detail의 `HOUSE_SECD`로 갈린다(04 무순위 / 06 불법행위 재공급)
→ `competitionOperationFor(type, houseSecd)` 로 분기.

**(C) 부동산통계** — 통계표 코드

```ts
export const REBSTAT_TABLES = {
  apartmentSalePriceIndex:       'A_2024_00045',  // 아파트 매매가격지수 (월)
  apartmentJeonsePriceIndex:     'A_2024_00050',  // 아파트 전세가격지수 (월)
  apartmentRealTransactionIndex: null,            // TODO: 공동주택 실거래가격지수 — 미확인
} as const

export const REBSTAT_ITM_INDEX = 100001   // ITM_ID: "지수"
export const REBSTAT_CYCLE_MONTHLY = 'MM' // DTACYCLE_CD
```

매매·전세 코드는 실제 호출로 확인했다. **공동주택 실거래가격지수 코드는 미확인** —
R-ONE 통계코드 검색(로그인 후 `/r-one/portal/openapi/openApiGuideCdPage.do`)에서
"실거래가격지수"로 검색해 확보한다. JS 동적 렌더링이라 자동 조회가 안 된다.

코드가 `null`이면 해당 라우트가 `503 REBSTAT_TABLE_UNKNOWN` 을 내고 **그 섹션만 사라진다.**
덕분에 클라이언트·정규화·차트·테스트를 픽스처로 전부 완성할 수 있고, Phase 8에서 상수 하나만 채우면 살아난다.

지가변동률·상업용 임대동향·오피스텔동향·부동산거래현황은 이번 범위에서 제외한다.

### 환경변수

| 이름 | 용도 | 없을 때 |
|---|---|---|
| `ODCLOUD_SERVICE_KEY` | (A)(B) 공용, 포털 **Decoding** 키 | notices·competition만 503, 나머지 정상 |
| `REB_STAT_API_KEY` | (C), R-ONE 별도 발급 | market만 503 → 통계 섹션만 사라짐 |
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | 지도 (클라이언트 노출이 정상) | KakaoMap 섹션 자체를 렌더하지 않음 |

**서버 키에 `NEXT_PUBLIC_` 접두어 금지.** 지도 키만 예외다.
`.gitignore`에 `.env*`가 첫 커밋 전부터 들어가 있다.

**소스별 독립 실패**: 한 소스의 키가 없어도 나머지 기능은 정상 동작한다.

---

## 4. 정규화 계층 — 이 프로젝트의 핵심

소스별 함정을 여기서 전부 흡수한다. 화면은 깨끗한 타입만 본다.

### 4.0 정규화의 판단 기준: 값의 집합을 누가 정하는가

**정규화는 필드 이름을 camelCase로 바꾸는 것이 아니다.** 값을 우리가 통제하는 표현으로 바꾸는 것이다.
이름만 바꾸고 값을 그대로 통과시킨 필드는 **여전히 raw다.**

| 필드 | 값의 출처 | 로직에 쓸 수 있나 |
|---|---|---|
| `status` (`NoticeStatus`) | 우리 | ✅ |
| `resideKind` (`ReceiptArea`) | 우리 | ✅ |
| `houseTypeKey` (`normalizeHouseType`) | 우리 | ✅ |
| `region` (17개 화이트리스트 통과) | 우리 | ✅ |
| `houseType` (`HOUSE_TY` 원문) | API | ❌ 표시용만 |
| `resideArea` (`RESIDE_SENM`) | API | ❌ 표시용만 |
| `rateRaw` (`CMPET_RATE` 원문) | API | ❌ 표시용만 |

**표시 문자열에 로직을 걸면 조용히 깨진다.** API가 `"해당지역"` → `"해당 지역"`으로 바꾸면
에러도 없고 화면도 멀쩡한데 판정만 틀린다. Phase 4에서 `resideArea === '해당지역'` 비교가
실제로 그 상태였고, `RESIDE_SECD` 코드값에서 `resideKind`를 도출해 해소했다.

**변경이 예고된 축에서는 특히 위험하다** — R-ONE 지역명(§4.5④)은 전남광주통합특별시 출범으로
표기가 바뀔 수 있다. 그 축은 반드시 `CLS_ID`(숫자 코드) 기준으로 매핑한다.

### 4.1 공통 타입

```ts
// lib/types.ts
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
  minPrice: number | null       // 만원 — 목록 응답에서는 항상 null (아래 주의)
  maxPrice: number | null       // 만원 — 상세 응답에서만 채워진다
  totalUnits: number | null
  noticeUrl: string | null
}

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
  resideKind: ReceiptArea | null // RESIDE_SECD(01/02/03)에서 도출 — 로직 판정용
  resideArea: string | null     // RESIDE_SENM — 표시용만
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
```

모든 날짜 필드는 ISO `yyyy-MM-dd` 문자열이다.

**`Notice`에는 `dday`·`status`를 담지 않는다.** 캐시에 구워지면 시간이 지나 틀린 값이 되기 때문이다.
Route Handler가 응답 시점에 덧붙인다(§6).

#### `status`는 4값이다 (Phase 1 구현 중 추가)

```ts
export type NoticeStatus = 'upcoming' | 'open' | 'closed' | 'unknown'
```

접수 일정이 아직 확정되지 않은 공고가 존재한다. 3값 체계에서는 이것이 `open`으로 떨어져
"접수중 n건"을 오염시킨다.

**판정 원칙: 종료일이 없으면 마감 판정 불가.**

```ts
if (start && start > today)  status = 'upcoming'   // 시작일이 미래면 종료일 유무와 무관
else if (!end)               status = 'unknown'    // 종료일 없음 → 판정 불가
else if (end < today)        status = 'closed'
else                         status = 'open'
```

| `receiptStart` | `receiptEnd` | `status` |
|---|---|---|
| 미래 | 있음 / 없음 | `upcoming` |
| 과거 / 없음 | **없음** | `unknown` |
| 과거 / 없음 | 과거 | `closed` |
| 과거 / 없음 | 오늘 ~ 미래 | `open` |

"둘 다 `null`일 때만 `unknown`" 으로 잡으면 **시작일만 공고된 케이스**(`start` 있음 + `end` 없음)가
규칙을 빠져나가 영구 `open` + `dday: null`이 된다. 종료일 기준으로 잡아야 네 경우가 전부 덮인다.

**`status` 쿼리 필터의 허용값은 `open|upcoming|closed` 그대로다** — 응답만 `'unknown'`을 가질 수 있다.
`unknown` 공고는 필터 없는 상태에서만 목록에 나타난다. 탭을 4개로 늘리지 않는다.

`NoticeStatus`를 4값으로 넓힌 것은 비용이 아니라 이득이다. 컴포넌트에서 `Record<NoticeStatus, ...>`
또는 `default` 없는 `switch`를 쓰면 상태를 더 늘릴 때 고쳐야 할 지점을 **컴파일러가 전부 나열해준다.**
`DdayBadge` · `NoticeTable` · `SummaryBar`에서 이 패턴을 유지한다.

#### D-day는 KST 기준으로 계산한다 (Phase 1 구현 중 확정)

`date-fns`의 `differenceInCalendarDays`는 **서버 로컬 캘린더**로 동작한다.
Vercel 함수는 `TZ=UTC`로 돌기 때문에 그대로 쓰면 한국시간 00:00~09:00 동안 결과가 하루 밀린다
(마감된 공고가 `dday 0` · `open`으로 나온다).

→ `lib/dday.ts`에 `todayInSeoul(now)` 를 두고 **KST 기준 '오늘'** 과 비교한다.
`summary`의 `closingThisWeek`·`new` 도 같은 기준을 쓴다.
**`vitest.config.ts`에서 테스트를 `TZ=UTC`로 돌린다** — 로컬(KST)에서만 통과하는 테스트는
이 부류 버그를 잡지 못한다.

#### `minPrice`/`maxPrice`는 상세에서만 채워진다 (Phase 1 구현 중 확인)

분양가는 **Detail 응답에 없고 Mdl에만 있다**. Mdl은 `cond`가 `HOUSE_MANAGE_NO`/`PBLANC_NO`만
지원해서 배치 조회가 불가능하다. 목록은 Detail만 5개 팬아웃하므로 가격을 채울 수 없다.

→ **목록 응답의 `minPrice`/`maxPrice`는 항상 `null`이다.**
상세(`/api/notices/{id}`)만 Mdl을 조회해 `SupplyRow.price`의 min/max로 채운다.
Dashboard의 "분양가 범위" 열은 **화면에 보이는 행만 지연 조회**해 채운다(§8).

### 4.2 공통: 부분 실패 허용

목록 조회는 5개 오퍼레이션을 `Promise.allSettled`로 팬아웃한다.
개별 오퍼레이션 실패는 건너뛰고 나머지로 응답하며, 응답에 `sources[]`로 성공/실패를 표시한다.
한 유형이 죽어도 대시보드는 뜬다.

### 4.3 (A) 청약홈 — 흡수하는 함정

#### ① 날짜 형식이 유형마다 다르다

| 오퍼레이션 | `RCRIT_PBLANC_DE` 등 |
|---|---|
| APT / Urbty / Remndr Detail | `2026-08-13` |
| **PblPvtRent / OPT Detail** | **`20260813`** |
| `MVN_PREARNGE_YM` (전 유형) | `202608` |

스펙 초안은 "임의공급만 `YYYYMMDD`"로 봤으나, 실제로는 **공공지원 민간임대도 `YYYYMMDD`** 다.

**문자열 비교로 마감을 판정하면 조용히 뒤집힌다.** `"20260813" < "2026-08-20"` 은
숫자 `2`(0x32)와 하이픈 `-`(0x2D) 비교라 참이 되어버린다.
→ 모든 날짜를 `parseIsoDate()` **단일 함수**에 통과시켜 ISO로 변환한다.
빈 문자열 · `"-"` · 공백 · `null` 은 모두 `null`.

`cond[RCRIT_PBLANC_DE::GTE]` 에 넣는 값도 유형별 형식을 맞춰야 한다 → `formatCondDate(type, date)`.

#### ② 금액에 쉼표가 들어온다

`"27,600"` → `27600`. 쉼표 제거 후 파싱하고, 실패하면 `null`을 반환한다
(**0으로 떨어뜨리지 않는다** — 0원 분양과 구분되지 않기 때문).
실측 샘플은 쉼표 없는 `"36707"` 이었지만 양쪽을 다 받는다. 단위는 만원.

#### ③ 공급지역명이 짧은 표기다

`"서울특별시"`가 아니라 `"서울"`. 17개 화이트리스트로 검증하고 벗어나면 `null`.

#### ④ 접수일 필드가 유형마다 완전히 다르다

| 유형 | 접수 윈도우 |
|---|---|
| `APT` | 전체 + 특별 + 1순위×(해당·기타경기·기타지역) + 2순위×(해당·기타경기·기타지역) = **최대 8개** |
| `REMNDR` / `OPT` | 전체 + 특별 + 일반 = 3개 |
| `URBTY_OFCTL` / `PBL_PVT_RENT` | 전체 1개 |

**고정 6단계 타임라인으로는 그릴 수 없다.** 존재하는 윈도우로 타임라인을 생성하고,
없는 단계는 렌더하지 않는다(§9).

#### ⑤ 주택형(Mdl) 필드도 유형마다 다르다

| 유형 | 주택형 | 면적 | 금액 |
|---|---|---|---|
| APT / REMNDR / OPT | `HOUSE_TY` | `SUPLY_AR` (**공급면적**) | `LTTOT_TOP_AMOUNT` |
| URBTY_OFCTL / PBL_PVT_RENT | `GP` + `TP` | `EXCLUSE_AR` (**전용면적**) | `SUPLY_AMOUNT` |

**APT Mdl에는 전용면적 필드가 없다.** 공급면적만 온다.
→ `SupplyRow.area.kind`로 구분하고, 표 헤더 라벨을 유형에 따라 전환한다. 환산 추정은 하지 않는다.

#### ⑥ 주택형 표기가 두 형태로 관측된다

공식 스펙은 `"084.9500A"`, 라이브 캡처는 `"55㎡O"` · `"84㎡A"`.
→ `normalizeHouseType()`으로 **선행 숫자 + 말미 영문 접미사**를 뽑아 `"84.95A"` 형태로 정규화한다.
원문은 `houseType`에 보존해 화면에 그대로 보여준다.

#### ⑦ 유형별 어댑터 레지스트리

유형마다 필드명이 다르므로 어댑터를 따로 둔다. **raw 키를 아는 곳은 어댑터뿐이다.**

```ts
// lib/applyhome/adapters/index.ts
interface NoticeAdapter {
  detailOperation: string
  mdlOperation: string
  dateFormat: 'iso' | 'compact'
  areaKind: 'exclusive' | 'supply'

  // raw 필드명은 여기에만 존재한다
  condFields: {
    noticeNo: string          // 'PBLANC_NO'
    houseManageNo: string     // 'HOUSE_MANAGE_NO'
    noticeDate: string        // 'RCRIT_PBLANC_DE'
  }

  toNotice(raw: unknown): Notice
  toSupplyRows(raw: unknown[]): SupplyRow[]
  toRegulation(raw: unknown): Regulation   // APT만 실제 반환, 나머지는 available: false
}

export const ADAPTERS: Record<NoticeType, NoticeAdapter> = { ... }
```

**`condFields`가 왜 필요한가**: `cond[PBLANC_NO::EQ]` 같은 raw 키를 라우트나 클라이언트에
하드코딩하면 "raw 키를 아는 곳은 어댑터뿐"이 깨진다. 5개 유형이 우연히 같은 cond 필드명을 쓰기 때문에
동작은 맞지만, **Phase 8에서 어댑터만 고치면 되게 만드는 전제**가 여기서 무너진다.
라우트는 `` `cond[${adapter.condFields.noticeNo}::EQ]` `` 로 조립한다.

**`toRegulation`도 같은 이유**다. §5가 `regulation.flags[].key`로 raw 키를 응답에 그대로 노출하는
계약이므로 그 값을 만드는 주체는 어댑터일 수밖에 없다.

### 4.4 (B) 경쟁률 — 조인 전략

**`MODEL_NO` 우선, `houseTypeKey` 폴백.**

`HOUSE_TY`는 (A)(B) 양쪽에 같은 필드명으로 존재하지만, 같은 공고에서 바이트 단위로
일치하는지는 실증되지 않았다. `MODEL_NO`는 `getAPTLttotPblancCmpet` ·
`getUrbtyOfctlLttotPblancCmpet` · `getPblPvtRentLttotPblancCmpet` ·
`getCancResplLttotPblancCmpet` 와 (A) Mdl 양쪽에 모두 있다.

→ `MODEL_NO`가 양쪽에 있으면 그것으로 조인, 없으면(`getRemndrLttotPblancCmpet`,
`getOPTLttotPblancCmpet`) `houseTypeKey`로 폴백.

**조인 실패는 에러가 아니다.** 접수가 진행 중이거나 데이터가 아직 없는 공고는 정상적으로 존재한다.
→ 해당 열을 숨기고 넘어간다.

**경쟁률 값 파싱**: `CMPET_RATE`는 `string` 타입이다. 청약홈 화면에서 미달 시 `△` 표기가
관측됐으므로(API 필드 포함 여부는 미확인), `parseCompetitionRate()`가 숫자면 `rate`,
아니면 `rate=null` + `rateRaw`에 원문 보존. 화면은 `rateRaw`를 보여주고 정렬은 `rate`에만 적용한다.

**특별공급 신청현황**은 `getAPTSpsplyReqstStus`로 **APT만** 제공된다.
거주지역(`CRSPAREA_` 해당 / `CTPRVN_` 기타경기 / `ETC_AREA_` 기타지역) × 유형 2차원 구조다.
다른 유형은 전용 오퍼레이션이 없다.

**당첨가점**은 `getAptLttotPblancScore` (`LWET_SCORE` / `TOP_SCORE` / `AVRG_SCORE`), APT 전용.
가점 계산기 결과와 나란히 보여준다(§10).

### 4.5 (C) 부동산통계 — 흡수하는 함정

#### ① 키 없이 호출하면 에러가 아니라 데이터 5건이 온다

`KEY` 파라미터를 **생략**하면 에러가 아니라 `INFO-000` 정상 응답에 **실제 데이터 5건**이 온다
(`pSize`를 300으로 줘도 5건). 정상 응답처럼 보여서 디버깅을 크게 헤매게 하는 지점이다.

> 개발가이드 문서에는 "10건"으로 적혀 있으나 실측은 **5건**이었다. 문서-실측 불일치.

→ **응답 건수가 5건 이하이고 요청한 기간이 그보다 길면 키 미적용으로 간주해 명시적 에러**를 던진다.

```ts
if (rows.length <= 5 && requestedMonths > rows.length) throw new RebstatSampleResponseError()
```

**`clampToRange`를 이 판정보다 먼저 실행해야 한다** (Phase 5 구현 중 실측으로 확정).

키가 미적용이면 상류는 **요청 기간과 무관한 고정 표본 5건**을 준다. 그 5건이 요청 창 밖이면:

| 순서 | `months=1` 요청 시 | 결과 |
|---|---|---|
| **clamp → 판정** | `isSampleResponse(0, 1)` → `0<=5 && 1>0` | ✅ 잡는다 |
| 판정 → clamp | `isSampleResponse(5, 1)` → `5<=5`, **`1>5` 거짓** | ❌ 조용히 빈 배열 |

`months`가 5 이하면 `requestedMonths > rowCount` 조건이 자르기 전 건수로는 성립하지 않는다.
**두 안전장치가 같은 기준(자른 뒤 건수)에서 비교돼야 한다.**

남는 한계: 이력이 희소한 통계표에서 정상 데이터를 오탐할 수 있다(상류 8건 중 3건만 창 안 →
`3<=5 && 36>3`). 현재 쓰는 통계표는 이력이 길어 해당 없고, Phase 8 체크리스트에
"정상 키로 호출 시 건수가 5건을 넘는지"로 올려뒀다.

한편 `KEY`에 **잘못된 문자열**을 넣으면 명시적 에러가 온다:
`{"RESULT":{"CODE":"ERROR-290","MESSAGE":"인증키가 유효하지 않습니다..."}}`
(스펙 초안이 예상한 `INFO-100`이 아니다.) → 이 코드는 그대로 에러로 매핑한다.

우리 클라이언트는 키가 없으면 호출 전에 503을 내므로 ①에 빠질 일은 없지만,
가드는 방어로 남긴다.

#### ② json을 요청해도 xml이 올 수 있다

`Type`의 기본값이 `xml`이므로 **반드시 `Type=json`을 명시한다.**
그럼에도 에러 응답이 xml로 오는 케이스가 보고돼 있다(이번 조사에서는 재현되지 않음).
→ `JSON.parse` 실패 시 `fast-xml-parser`로 재시도하고, 양쪽을 같은 중간 형태로 정규화한 뒤
어댑터에 넘긴다.

#### ③ 응답 구조

```json
{
  "SttsApiTblData": [
    { "head": [ {"list_total_count": 56148},
                {"RESULT": {"CODE":"INFO-000","MESSAGE":"정상 처리되었습니다."}} ] },
    { "row": [ { "STATBL_ID":"A_2024_00045", "DTACYCLE_CD":"MM",
                 "WRTTIME_IDTFR_ID":"202501", "CLS_ID":500001, "CLS_NM":"전국",
                 "ITM_ID":100001, "ITM_NM":"지수", "DTA_VAL":97.2393481656035,
                 "UI_NM":"지수", "CLS_FULLNM":"전국", "WRTTIME_DESC":"2025년 1월" } ] }
  ]
}
```

최상위 래퍼는 `SttsApiTblData` 배열(`[0]`=head, `[1]`=row).
**에러 시엔 래퍼 없이 `{"RESULT":{...}}` 단독으로 온다** → 파서가 두 형태를 모두 처리해야 한다.

시점은 `WRTTIME_IDTFR_ID`(`YYYYMM`), 값은 `DTA_VAL`.

#### ④ 지역 축이 (A)와 다르다

`CLS_FULLNM`은 **시도 > 권역 > 시 > 구** 다단계 트리다
(예: `경기>경부1권>안양시>만안구`, `서울>강북지역`).
최상위 세그먼트는 (A)와 같은 축약형(`서울` · `경기` · `부산` · `충남` …)이라 **표기는 일치**한다.

`전국`은 `CLS_ID=500001` 단독 행으로 존재한다(확인).
**시도 단독 집계행의 `CLS_ID`는 미확인** — 샘플 5건 범위에서 `전국`만 확인됐다.

```ts
// lib/config.ts
export const REBSTAT_REGION_CLS_ID: Record<'전국' | Region, number | null> = {
  전국: 500001,   // 확인
  서울: null,     // TODO: 통계코드 검색 또는 인증키로 CLS_ID 조회
  // ... 17개 모두 null
}
```

**매핑에 없는 지역은 통계 섹션만 숨긴다.** 전체 실패로 만들지 않는다.
기본값 `전국`은 확인됐으므로 MarketStrip 기본 동작은 Phase 5에서 바로 검증된다.

> **재확인 필요**: R-ONE 공지에 "2026년 7월 전남광주통합특별시 출범에 따른 지수 기준시점 변경"이
> 있었다. 지역 표기명이 바뀌었을 수 있으므로 매핑 테이블을 채울 때 반드시 현행 값을 확인한다.

#### ⑤ 기간 파라미터가 미검증이다

`START_WRTTIME` / `END_WRTTIME` 이 개발가이드에 존재하지만 실호출로 검증하지 못했다
(값 형식 `YYYYMM` 추정). `WRTTIME_IDTFR_ID`로 특정 시점 필터링은 확인됐다.

→ **필터가 동작하지 않아도 결과가 틀리지 않게 설계한다.**
`START_WRTTIME`/`END_WRTTIME`을 넣어 요청하되, 어댑터에서 **항상 요청한 기간으로 잘라낸다.**
통계표 전체 건수가 56,148건이므로 `CLS_ID` + `ITM_ID` + `DTACYCLE_CD` 필터는 필수다.

### 4.6 단위 테스트 범위

vitest로 **아래에만** 붙인다. UI는 브라우저로 확인한다.

| 대상 | 테스트 파일 | 핵심 케이스 |
|---|---|---|
| 날짜 파싱 | `parse.test.ts` | `20260813` / `2026-08-13` / `""` / `"-"` / `null`, 두 형식 혼재 비교 |
| 금액 파싱 | `parse.test.ts` | `"27,600"` / `"36707"` / `""` / `"미정"` → `null` (0 아님) |
| D-day 계산 | `dday.test.ts` | 오늘 마감 = D-0, 경계, `status` 전이(upcoming/open/closed) |
| 주택형 정규화 | `parse.test.ts` | `"084.9500A"` ↔ `"84㎡A"` → 같은 키 |
| 유형별 매핑 | `adapters.test.ts` | 5개 유형 픽스처 → `Notice` (접수 윈도우 개수 포함) |
| 지역 매핑 | `region.test.ts` | 17개 화이트리스트, 미매핑 → `null`, R-ONE `CLS_FULLNM` 최상위 추출 |
| sample 응답 감지 | `rebstat-sample.test.ts` | 5건 + 36개월 요청 → throw, 36건 → 통과 |

---

## 5. API 계약

응답은 **프론트가 그대로 그릴 수 있는 JSON**이다. 계산은 서버에서 끝낸다.

### `GET /api/health`

```json
{ "ok": true, "time": "2026-09-22T07:00:00.000Z",
  "keys": { "odcloud": true, "rebstat": false, "kakaoMap": true },
  "rebstatTables": { "sale": true, "jeonse": true, "realTransaction": false },
  "fixtures": false }
```

**키 값은 절대 내리지 않는다.** 존재 여부 불리언만.

`keys.*`는 **실제 환경변수 존재 여부**다. 개발용 픽스처 모드(§2.1)로 돌고 있어도
키가 없으면 `false`여야 한다 — **없는 키를 있다고 보고하면 나중에 디버깅 비용이 된다.**
픽스처 모드 여부는 `fixtures` 필드로 따로 노출한다.

### `GET /api/notices?region=&type=&status=`

- `region` — 반복 파라미터 (`?region=서울&region=경기`), 생략 시 전체
- `type` — `NoticeType`, 생략 시 전체
- `status` — `open` | `upcoming` | `closed`, 생략 시 전체

```json
{
  "notices": [ { "...Notice 필드", "dday": 3, "status": "open" } ],
  "summary": { "open": 12, "closingThisWeek": 3, "new": 5 },
  "sources": [
    { "type": "APT", "ok": true, "count": 40 },
    { "type": "OPT", "ok": false, "error": "upstream 500" }
  ],
  "fetchedAt": "2026-09-22T07:00:00.000Z"
}
```

**`summary` 정의** (화면과 어긋나지 않게 여기에 박는다):

| 키 | 정의 | `unknown` 공고 |
|---|---|---|
| `open` | `status === 'open'` | 제외 |
| `closingThisWeek` | `receiptEnd`가 **오늘 ~ +6일** (롤링 7일 윈도우) | 제외 (종료일이 없다) |
| `new` | `noticeDate`가 최근 7일 | **포함** |

`new`에 `unknown`을 포함하는 것은 의도된 동작이다. `new`는 공고일 기준이고, 일정 미정 공고야말로
"막 뜬 신규 공고"다. 그래서 "신규 5건"인데 status 탭 어디에도 없는 공고가 생길 수 있다.

**`summary`는 `status` 쿼리 필터를 반영하지 않는다.** region·type 필터만 적용한 전체 목록 기준이다.
status를 반영하면 `?status=open`에서 `summary.open`이 전체 건수와 같아져 현황판이 자기 자신을 세게 된다.

**조회 범위**: `cond[RCRIT_PBLANC_DE::GTE]`로 **모집공고일 직전 3개월**만 받는다.
개발계정 일일 호출 한도 때문에 전체 조회는 하지 않는다.

**지역 필터는 상류로 넘기지 않는다.** `SUBSCRPT_AREA_CODE_NM::EQ`는 APT Detail만 지원하고,
나머지는 숫자 `SUBSCRPT_AREA_CODE::EQ`뿐인데 그 코드값이 `410`=경기 외에는 미검증이다.
`PBL_PVT_RENT` Detail은 지역 필터가 아예 없다.
→ 기간만 좁혀 받고 지역 필터는 우리 코드에서 적용한다. 5개 유형을 균일하게 다룰 수 있다.

### `GET /api/notices/{id}?type=`

```json
{
  "notice": { "...Notice", "dday": 3, "status": "open" },
  "supply": [ "...SupplyRow" ],
  "regulation": { "available": true,
                  "flags": [ { "key": "PARCPRC_ULS_AT", "label": "분양가상한제" } ],
                  "note": "전매제한·재당첨제한은 공고문에서 확인" },
  "noticeUrl": "https://www.applyhome.co.kr/..."
}
```

`{id}`는 `PBLANC_NO`다. Mdl 조회에는 `HOUSE_MANAGE_NO`도 필요하므로,
`cond[PBLANC_NO::EQ]={id}` 로 Detail을 먼저 조회해 `HOUSE_MANAGE_NO`를 얻고
그 다음 Mdl을 두 키로 조회한다. URL에 두 개를 노출하지 않기 위한 선택이며,
30분 캐시가 있어 추가 호출 비용은 무시할 수 있다.

`regulation.available`은 **APT일 때만 `true`** 다. 다른 유형 Detail에는 규제 필드가 전무하다.

### `GET /api/notices/{id}/competition`

```json
{
  "rows": [ { "modelNo": "01", "houseType": "084.9500A",
              "competition": [ "...CompetitionRow" ],
              "score": { "lowest": 64, "highest": 74, "average": 68.2 } } ],
  "specialSupply": { "available": true, "byType": [ ... ] },
  "joinedBy": "modelNo"
}
```

**데이터가 없으면 `204 No Content`.** 접수 진행 중이거나 아직 집계되지 않은 공고는 정상이다.

### `GET /api/market/price-index?region=&months=36`

```json
{
  "region": "전국",
  "baseNote": "기준시점 = 100. 절대 가격이 아니라 지수다.",
  "series": [ "...MarketSeries(sale)", "...MarketSeries(jeonse)" ]
}
```

### `GET /api/market/real-transaction?region=&months=36`

`series`에 `realTransaction` 하나.

**공통**: `months`는 1~120으로 clamp. **전월 대비(mom)·전년 동월 대비(yoy)는 서버에서 계산**해
`series[].change`로 내려보낸다. 프론트는 배지만 그린다.

### 에러 규약

| 상황 | 응답 |
|---|---|
| 청약홈 키 없음 | `503 { "error": "ODCLOUD_KEY_MISSING" }` |
| 통계 키 없음 | `503 { "error": "REBSTAT_KEY_MISSING" }` |
| 통계표 코드 미확정 | `503 { "error": "REBSTAT_TABLE_UNKNOWN" }` |
| 지역 `CLS_ID` 미매핑 | `503 { "error": "REBSTAT_REGION_UNMAPPED" }` |
| 통계 키 무효 (ERROR-290) | `502 { "error": "REBSTAT_KEY_INVALID" }` |
| sample 응답 감지 | `502 { "error": "REBSTAT_SAMPLE_RESPONSE" }` |
| 공고 없음 (Detail 0건) | `404 { "error": "NOTICE_NOT_FOUND" }` |
| 쿼리 검증 실패 | `400` + zod 이슈 |

`region`·`type`·`status` 모두 **화이트리스트 검증**을 거친다. `region`을 자유 문자열로 두면
`?region=서울특별시` 같은 오타가 400이 아니라 **조용히 0건**으로 내려간다.

**market 계열 503이 여러 개 동시에 성립할 때의 순서** (Phase 5 구현 중 확정):

```
1. REBSTAT_KEY_MISSING      키 없음 — 사용자가 바로 조치할 수 있는 원인
2. REBSTAT_TABLE_UNKNOWN    통계표 코드 미확정
3. REBSTAT_REGION_UNMAPPED  지역 CLS_ID 미확정
```

`real-transaction?region=서울` + 키 없음이면 `KEY_MISSING`이 나온다.
**가장 실행 가능한 원인을 먼저** 알려주는 순서다.

프론트는 **market 계열 503/502를 "섹션 숨김"으로**, notices 503을 전면 안내로 처리한다.

---

## 6. 캐시

소스별 갱신 주기가 다르므로 TTL을 다르게 준다. 개발계정 일일 호출 한도가 있어 캐시는 선택이 아니다.

| 대상 | TTL | 근거 |
|---|---|---|
| 공고 목록 | **10분** | 신규 공고가 수시로 뜬다 |
| 공고 상세 · 경쟁률 · 당첨가점 | **30분** | 공고 확정 후엔 거의 안 변한다 |
| 부동산통계 | **24시간** | 월 단위 공표 |

두 겹으로 구성한다.

```ts
// lib/cache.ts
// 저장: Next Data Cache
fetch(url, { next: { revalidate: TTL } })

// 합류: 같은 키 동시 요청을 한 번만 부른다
const inflight = new Map<string, Promise<unknown>>()
export function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> { ... }
```

Data Cache는 저장은 해주지만 **동시 cold miss를 합쳐주지 않는다.**
Next가 자동으로 합쳐주는 것은 **단일 요청 처리 안에서** 같은 URL을 중복 호출하는 경우
(request memoization)이고, 별개 라우트 핸들러 호출 사이에는 적용되지 않는다.
그래서 in-flight 맵이 별도로 필요하다.

**`dedupe()`는 반드시 상류 호출 경로에 실제로 걸어라.** 배선하지 않고 파일만 두면
§6이 지켜진다는 착각만 남는다. 미배선 상태에서는 TTL 만료 직후 동시 진입 N개가 각각
5유형 팬아웃 × 페이지 수만큼 상류를 때린다.

**키는 파라미터별로 분리한다** — 조회 유형 + 조회 시작일을 키에 넣는다. region·type이 다른 요청이
같은 키로 합쳐지면 결과가 오염된다.

**한계를 알고 쓴다: `dedupe` 맵은 프로세스 단위다.** 서버리스 인스턴스가 여러 개면 인스턴스별로만
합쳐진다. 상류 호출을 전역 1회로 줄이는 장치가 아니라 **인스턴스 내 중복을 없애는 장치**다.
기대치를 여기에 맞춰라 — "dedupe 했는데 왜 여전히 중복이 보이나"를 두 번 조사하지 않기 위한 기록이다.

**D-day는 캐시에 굽지 않는다.** 캐시에는 날짜만 담긴 `Notice`가 들어가고,
Route Handler가 응답 시점의 `Date.now()` 기준으로 `dday`·`status`를 다시 계산해 덧붙인다.
캐시된 값에 D-day가 들어 있으면 10분 뒤에는 틀린 숫자를 내보내게 된다.

---

## 7. UI 무드와 포맷

### 테마

라이트 테마 단일. Tailwind v4 `@theme` 토큰으로 정의한다.

```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  --color-canvas:     #f5f5f4;   /* 뉴트럴 그레이 배경 */
  --color-surface:    #ffffff;   /* 카드 화이트 */
  --color-border:     #e7e5e4;
  --color-ink:        #1c1917;
  --color-ink-muted:  #78716c;
  --color-urgent:     #dc2626;   /* D-3 이내 배지 */
  --color-up:         #16a34a;   /* 상승 변동률 */
  --color-down:       #dc2626;   /* 하락 변동률 */
  --color-line:       #44403c;   /* 지수 차트 단색 라인 */
  --color-line-base:  #d6d3d1;   /* 기준선 100 */
}
```

### 규칙

- **숫자·금액은 우측 정렬** + `tabular-nums` (자릿수가 흔들리지 않게).
- **금액은 억/만 단위로 축약**: `27600` → `"2억 7,600만"`.
- **D-day는 단색 배지.** D-3 이내 빨강, 그 외 중립. 그라데이션·아이콘 없음.
- **지수 차트는 단색 라인 + 기준선(100) 표시.** 색으로 의미를 싣지 않는다.
- **상승/하락 변동률만 초록·빨강.**
- 지수는 기준시점 100 기반이므로 **절대 가격이 아니라는 각주**를 차트마다 붙인다.

예외: RegionMarket은 매매·전세·실거래 3개 라인을 겹치므로 상색으로 구분한다(§9).
MarketStrip은 단색 1라인 원칙을 지킨다.

### 포맷 함수

```ts
// lib/format.ts
formatManwon(27600)        // "2억 7,600만"
formatPriceRange(a, b)     // "2억 7,600만 ~ 3억 9,358만" / 한쪽만 있으면 그 값
formatArea(84.95)          // "84.95㎡"
formatDday(3)              // "D-3" / 0 → "D-DAY" / 음수 → "마감"
formatChange(-0.12)        // "▼ 0.12%"
formatMonth('202501')      // "2025.01"
```

---

## 8. Dashboard (`/`)

위에서 아래로:

1. **SummaryBar** — 접수중 n건 / 이번주 마감 n건 / 신규공고 n건
2. **DeadlineCards** — D-3 이내, 최대 5장
3. **TypeTabs** — APT / 무순위·잔여 / 오피스텔·도시형 / 공공지원 민간임대 / **관심**
4. **RegionFilter** — 지역 멀티 선택
5. **NoticeTable** — 주택명 / 지역 / 공급위치 / 접수기간 / D-day / 당첨발표 / 분양가 범위
6. **MarketStrip** — 선택 지역(기본 전국) 아파트 매매가격지수 최근 24개월 라인 + mom/yoy 배지.
   `RegionFilter`가 멀티 선택이므로 **정확히 하나 선택됐을 때만 그 지역**, 0개 또는 2개 이상이면
   `전국`이다. 첫 선택 지역을 임의로 고르면 "서울+경기를 골랐는데 서울만 보여주는" 상태가 된다.

### 동작

- 행 클릭 → `/notices/{id}?type={type}`
- **관심 공고**: `localStorage`에 **id만** 저장. 상단 "관심" 탭에서 모아본다.
  `useFavorites()`는 SSR 안전하게 `useEffect` 이후에 읽는다(하이드레이션 불일치 방지).
- react-query `refetchInterval: 600_000`, `staleTime: 600_000` — 10분 자동 갱신.
- 임의공급(`OPT`)은 별도 탭을 두지 않고 전체 목록에 포함한다(스펙의 탭 4종을 유지).
- **통계 키가 없으면 MarketStrip만 사라진다.** 나머지는 정상 동작한다.

### 분양가 범위 열은 지연 조회한다

목록 응답에는 분양가가 없다(§4.1 — Detail에 가격 필드가 없다).
목록 응답 요소 타입은 `NoticeListItem = Omit<Notice, 'minPrice' | 'maxPrice'>` 로 좁혀
**"`null`이 값인 척"** 하지 않게 한다. 상세 응답은 `Notice` 그대로다.

→ **화면에 보이는 행만** `/api/notices/{id}` 를 호출해 `minPrice`/`maxPrice`를 채운다.

- react-query로 행별 조회. `staleTime`을 **상세 TTL 30분과 맞춘다** — 목록은 10분, 상세는 30분이라
  값이 어긋나면 캐시 두 겹이 서로 다른 시점을 본다.
- 상세 호출 하나가 상류 **2콜**(Detail + Mdl)이다. 뷰포트·페이지네이션으로 동시 조회 행 수를 묶어라.
- **`dedupe()` 배선이 선결이다.** 행 클릭으로 상세 페이지에 진입하는 것과 지연 조회가 겹치면
  같은 키로 동시 cold miss가 나 상류를 두 번 때린다.
- 로드 전에는 스켈레톤을 보여주고, 실패하면 `—` 로 둔다. 목록 전체를 실패로 만들지 않는다.
- 전량 조회(공고당 Mdl 호출)는 하지 않는다 — 3개월치 수십~수백 건 × 10분 TTL이면
  개발계정 일일 한도를 넘긴다.

### 탭과 필터의 관계

탭은 **전체 / APT / 무순위·잔여 / 오피스텔·도시형 / 공공지원 민간임대 / 관심** 6개다.
**기본 활성은 "전체"**. 유형 탭이 4개라는 뜻이고, 임의공급(`OPT`)은 전용 탭 없이 전체 탭에서 보인다
— 전체 탭이 없으면 `OPT`가 어디에도 안 뜨고 관심 등록 진입점도 사라진다.

**SummaryBar·DeadlineCards·NoticeTable은 같은 `/api/notices` 쿼리 결과 하나를 공유한다.**
region·type 필터를 바꾸면 세 영역이 함께 변한다(§5 — `summary`는 region·type을 반영한다).
같은 화면에서 두 번째 목록 쿼리를 만들지 않는다.

**관심 탭만 예외**다. 관심은 서버 필터가 아니라 `localStorage`의 id 목록으로 하는
**클라이언트 측 필터**라 서버 `summary`가 알 방법이 없다. 관심 탭에서는 **표만** 좁히고
SummaryBar·DeadlineCards는 현재 region 범위 기준을 유지한다. 의도된 동작이다.

### `unknown` 상태 렌더 규칙

- **`DdayBadge`** — `status`로 분기하고 `dday`는 표시용으로만 쓴다.
  `unknown` → **"일정 미정" 중립 칩**. `--color-urgent` 금지 — 미정을 긴급으로 보이게 하면 안 된다.
- **`NoticeTable`** — 접수기간 칸에 "미정". 마감일 정렬은 **null-last** 규칙을 명시한다
  (안 하면 브라우저별로 튄다).
- **`DeadlineCards`** — `unknown` 제외. "D-3 이내" 정의상 들어올 수 없다.

---

## 9. NoticeDetail (`/notices/{id}`)

1. **NoticeHeader** — 주택명 · 지역 · 총 공급세대 · D-day · **내 가점 배지**
2. **ScheduleTimeline** — 모집공고 → (특별) → (1순위) → (2순위) → 당첨발표 → 계약
3. **SupplyTable** — 면적 / 공급세대 / 분양가 / 특별공급 세부 / 경쟁률 / 최저 당첨가점
4. **SpecialSupplyBox** — 특별공급 유형별 접수현황 (**APT 전용**)
5. **RegulationBox** — 규제 플래그 (**APT 전용**)
6. **RegionMarket** — 지역 지수 36개월 추이
7. **공고문 원문 링크**
8. **KakaoMap** — 공급위치 지도
9. **AISection** — 플레이스홀더

**유형별로 렌더되는 섹션이 다르므로, 각 섹션은 데이터가 없으면 스스로 `null`을 반환한다.**
상세 페이지가 유형별 분기 로직을 들고 있지 않게 한다.

### ScheduleTimeline

APT는 접수 윈도우가 최대 8개다. 고정 단계로 그릴 수 없다.

→ **순위로 묶고 거주지역은 보조표기.** 1순위는 `min(start) ~ max(end)` 한 단계로 접고,
그 아래 작은 글씨로 분해한다:

```
1순위   9/28 ~ 9/29
        해당 9/28 · 기타경기 9/29 · 기타 9/29
```

존재하는 윈도우만 렌더하고, 지난 단계는 흐리게 처리한다.
**"지난 단계" 판정은 `todayInSeoul()` 기준이다** — 상세 페이지가 클라이언트 컴포넌트라
브라우저 로컬 시간을 쓰면 KST가 아닌 환경에서 하루 밀린다(§4.1과 같은 함정).

#### `kind: 'all'`은 폴백으로만 쓴다 (Phase 3 구현 중 확정)

`all`은 "전체 접수기간"이지 타임라인의 단계가 아니다. 그런데 단순 처리가 양쪽으로 깨진다:

| 공고 | 윈도우 | 단순 처리의 결과 |
|---|---|---|
| `REMNDR` | `all` + `general` — **날짜가 동일한 케이스가 실재한다** | 항상 렌더하면 같은 단계가 두 번 |
| `URBTY_OFCTL` / `PBL_PVT_RENT` | `all` 하나뿐 | 버리면 **접수 단계가 아예 사라진다** |

```
구체적 윈도우(special / first / second / general)가 하나라도 있으면 → all 을 렌더하지 않는다
하나도 없으면                                              → all 을 "청약접수" 단계로 렌더한다
```

`APT`·`REMNDR`·`OPT`는 구체적 윈도우가 있어 `all`이 빠지고,
`URBTY_OFCTL`·`PBL_PVT_RENT`는 `all`이 접수 단계로 살아난다.

### SupplyTable

**면적은 한 열, 헤더 라벨을 유형에 따라 전환한다.**

| 유형 | 헤더 |
|---|---|
| `APT` / `REMNDR` / `OPT` | 공급면적 |
| `URBTY_OFCTL` / `PBL_PVT_RENT` | 전용면적 |

같은 통에 다른 개념을 섞지 않고, 환산 추정도 하지 않는다.
경쟁률·당첨가점 열은 **데이터가 있을 때만** 렌더한다. 당첨가점은 APT 전용이다.

#### 경쟁률 셀은 대표값 하나 + 보조표기 (Phase 4 구현 중 확정)

`SupplyRow.competition`을 **단수로 타이핑한 것은 설계 결함**이다. 경쟁률은
**순위 × 거주지역 다차원**(`SUBSCRPT_RANK_CODE` × `RESIDE_SECD`)이라 단수로 담을 수 없다.
타입을 `CompetitionRow[]`로 바꾸는 것은 **Phase 8로 미룬다** — 현재 픽스처가 합성이라
실제 행 조합을 모른다. 그때 실제 응답을 보고 판단한다.

그동안은 대표값 하나를 고르고 **무엇의 경쟁률인지 보조표기**한다.
숫자만 보여주면 1순위 해당지역인지 2순위 기타지역인지 알 수 없고, 그 둘은 크게 다르다.

```
12.00
1순위 해당지역
```

**대표값 선택 순서**: ① 1순위 + `resideKind === 'corresponding'` → ② 최저 순위 → ③ 첫 항목.
사람들이 인용하는 숫자가 "1순위 해당지역 경쟁률"이다.
`rankCode`·`resideKind`가 모두 `null`인 유형(`REMNDR`·`OPT`·취소후재공급)은 ③으로 떨어지고
보조표기를 생략한다.

판정은 `resideKind`(코드 도출)로 하고 표기는 `resideArea`(API 표시명)로 한다 — §4.0.

### RegulationBox (APT 전용)

API가 제공하는 규제 플래그는 8개이고 전부 `Y`/`N`이다.

| 필드 | 라벨 |
|---|---|
| `SPECLT_RDN_EARTH_AT` | 투기과열지구 |
| `MDAT_TRGET_AREA_SECD` | 조정대상지역 |
| `PARCPRC_ULS_AT` | 분양가상한제 |
| `IMPRMN_BSNS_AT` | 정비사업 |
| `PUBLIC_HOUSE_EARTH_AT` | 공공주택지구 |
| `LRSCL_BLDLND_AT` | 대규모 택지개발지구 |
| `NPLN_PRVOPR_PUBLIC_HOUSE_AT` | 수도권 내 민영 공공주택지구 |
| `PUBLIC_HOUSE_SPCLW_APPLC_AT` | 공공주택 특별법 적용 |

`Y`인 항목만 칩으로 표시한다. 그리고:

> **전매제한·재당첨제한은 공고문에서 확인하세요.**

**"전매제한"·"재당첨제한"·"청약과열지역" 필드는 API 전체에 존재하지 않는다.**
(10개 오퍼레이션 스펙 전문 검색 결과 0건.) 값을 추측해 채우지 않고 공고문 링크로 넘긴다.

안내 문구는 서버가 `regulation.note`로 내려준다. **화면에 하드코딩하지 않는다.**

**플래그가 전부 `N`인 공고**(`flags: []`)는 섹션을 렌더하되 칩 대신 "해당하는 규제가 없습니다."를
표시하고 `note`는 유지한다 — "규제 지정이 없다"는 것 자체가 정보다. 빈 박스만 남기지 않는다.
`available: false`(APT 외 유형)는 섹션 자체를 렌더하지 않는다.

### RegionMarket

해당 지역의 **아파트 매매가격지수 · 아파트 전세가격지수 · 공동주택 실거래가격지수** 36개월 추이.

설명 문구:

> 분양가가 시세 흐름 대비 어느 수준인지 판단할 맥락입니다.

각주:

> 지수는 기준시점을 100으로 한 상대값입니다. 절대 가격이 아닙니다.

3개 라인이 겹치므로 여기서만 상색으로 구분한다(단색 원칙의 유일한 예외).
**색만으로 구분하지 않는다** — 점선 패턴을 함께 준다. 색은 `@theme` 토큰으로 정의한다.

| 시리즈 | 토큰 |
|---|---|
| 매매 | **`--color-line`** — MarketStrip의 단색 라인과 **같은 토큰**을 쓴다 |
| 전세 | `--color-series-jeonse` |
| 실거래 | `--color-series-real` |

매매에 전용 토큰을 따로 두면 안 된다. 두 화면(MarketStrip · RegionMarket)이 **같은 지수를
다른 색으로** 보여주게 된다 — 실제로 그렇게 만들었다가 되돌렸다(부록 34).
`--color-up`/`--color-down`은 상승·하락 전용이므로 시리즈 구분에 재사용하지 않는다.

`실거래가격지수`는 통계표 코드가 미확정이므로 해당 시리즈만 빠진 상태로 렌더될 수 있다.
**섹션 전체가 사라지면 틀렸다** — 매매·전세 2라인은 나와야 한다.

#### 기준선 100이 실제로 보이는지 확인해야 한다 (Phase 5 구현 중 확정)

`ReferenceLine y={100}`을 넣어도 recharts의 `domain={['auto','auto']}`는 데이터 범위만 보고
축을 잡는다. 지수가 95~99.7 구간에만 있으면 **100이 축 밖으로 잘려 기준선이 안 보인다.**
코드만 읽으면 통과로 보이고 화면을 봐야 잡히는 부류다.
→ Y축 도메인이 **데이터 min/max와 100을 항상 함께 포함**하게 한다.

#### Phase 8까지 RegionMarket은 렌더되지 않는다

`REBSTAT_REGION_CLS_ID`에 `전국`(500001)만 확정돼 있고 **17개 시도가 전부 `null`** 이다.
모든 실제 공고의 `region`은 시도 단위이므로 이 섹션은 항상 `503 REBSTAT_REGION_UNMAPPED` →
숨김이다. **설계가 의도한 graceful degradation이고 버그가 아니다.**

**픽스처 모드에서 미매핑 지역을 `전국`으로 대체하는 우회를 만들지 않는다** — 그러면 실제
매핑 공백이 가려져 Phase 8에서 놓친다. 조용히 숨는 것이 정직한 상태다.
Phase 8에서 `CLS_ID`를 채우면 코드 변경 없이 살아난다.

### KakaoMap

공급위치 **주소 문자열로 지오코딩**한다. 지구명·단지명은 검색 결과가 갈리기 때문이다.
지오코딩이 실패하면 지도를 숨긴다. `NEXT_PUBLIC_KAKAO_MAP_KEY`가 없으면 섹션 자체를 렌더하지 않는다.

### AISection

현재는 **"AI 분석 준비 중"** 플레이스홀더만 렌더한다. §13 참조.

---

## 10. 가점 계산기 (`/score`)

**순수 클라이언트 계산, 외부 호출 없음.** 84점 만점.

| 항목 | 만점 | 구간 |
|---|---|---|
| 무주택기간 | 32 | 1년 미만 2점, 이후 1년마다 +2, 15년 이상 32점 |
| 부양가족수 | 35 | 0명 5점, 1명마다 +5, 6명 이상 35점 |
| 청약통장 가입기간 | 17 | 6개월 미만 1점, 6개월~1년 2점, 이후 1년마다 +1, 15년 이상 17점 |

```ts
// lib/score.ts
export interface ScoreInput {
  noHouseYears: number    // 만 년
  dependents: number      // 명
  accountMonths: number   // 개월 — 년 단위로는 표를 표현할 수 없다(아래)
}
export function calcScore(input: ScoreInput): {
  total: number
  breakdown: { noHouse: number; dependents: number; account: number }
}
```

**청약통장은 개월 단위로 받는다** (Phase 6 구현 중 확정). 구간표가 "6개월 미만 / 6개월~1년"으로
시작하므로 `accountYears: number`로는 두 구간을 구분할 수 없다. `0.5`로 표현하면
부동소수 비교가 로직에 들어간다.

**경계 규칙** — 전부 조용히 틀리는 지점이다:

| 규칙 | 값 |
|---|---|
| 절단 | `Math.floor`. `14.9년`은 **30점**이다 — `Math.round`면 32점이 되어 2점이 틀리고 화면은 멀쩡하다 |
| 상한 부등호 | `>= 15` / `>= 6` / `>= 180`. `>`로 쓰면 정확히 그 지점에서 2·5·1점이 빠진다 |
| 입력 하한 | 0으로 clamp. 음수면 `2 + 2×(-1) = 0`으로 표가 명시한 최소 2점 아래로 내려간다 |

**총점 범위는 8~84다. 0이 아니다** — 최저 구간이 각각 2·5·1점이라 모든 입력이 0이어도 8점이다.
그래서 `useScore`가 `{0,0,0}`으로 초기화하고 배지를 그리면 **아무것도 입력하지 않은 사용자에게
"내 가점 8점"이 뜬다.** 초기값은 "미저장"을 표현할 수 있어야 한다(`null`).

경계값 테스트는 **§4.6 테스트 범위의 예외**로 붙인다 — 순수 함수이고 경계가 많고 전부 조용히 틀린다.

- 입력 폼은 **전용 `/score` 페이지**, 전역 헤더에서 링크한다.
- 값은 `localStorage`에 저장한다(`useScore()`, SSR 안전 — `useFavorites`와 같은 패턴).
- 상세 화면 상단에는 **배지만** 노출한다.
  점수가 저장돼 있지 않으면 배지 대신 **`/score`로 가는 링크**를 보여준다 — 빈 배지보다 낫고
  사용자를 계산기로 유도한다. 계산 결과를 상세 화면에서 조작하는 것이 아니므로 위 규칙과
  어긋나지 않는다.
- 당첨가점 데이터가 있으면 같은 화면에서 나란히 보여준다(참고용):

  ```
  내 가점 62점  ·  이 주택형 최저 당첨 64점
  ```

- 각주:

  > 산정 기준은 주택공급에 관한 규칙을 따릅니다.
  > **실제 가점은 청약홈 기준으로 확인하세요.**

---

## 11. 구현 순서

### Day 1

| Phase | 내용 |
|---|---|
| **1** | 픽스처 기반 청약홈 정규화 + 단위 테스트 + `/api/notices` · `/api/notices/{id}` + 캐시 |
| **2** | Dashboard + 관심 공고 |
| **3** | NoticeDetail — 헤더 · 타임라인 · 주택형 · 규제 |

### Day 2

| Phase | 내용 |
|---|---|
| **4** | 경쟁률 연동 + 특별공급 현황 + **당첨가점** |
| **5** | 부동산통계 클라이언트 + MarketStrip · RegionMarket 차트 |
| **6** | 가점 계산기 |
| **7** | 카카오 지도 + 프로덕션 빌드 + Vercel 배포 점검 |

> ⚠️ **Phase 4 착수 시 확인할 것**: `assertOdcloudKey()`는 픽스처 모드에서 문자열 `'fixture'`를
> 반환한다. 현재는 `fetchOdcloudPage`가 상류 진입 전에 가로채므로 무해하다. 그러나
> **경쟁률 클라이언트가 `assertOdcloudKey()`를 직접 호출하면 `Authorization: Infuser fixture`가
> 실제로 상류로 나간다.** 경쟁률 클라이언트도 픽스처 분기를 상류 호출 앞단에 둬라.

### Phase 8 (키 수령 후)

1. 세 소스에 `curl`을 날려 실제 응답을 확인한다.
2. 픽스처를 실제 응답으로 교체한다.
3. 테스트를 돌려 필드 차이를 드러낸다.
4. **어댑터만** 수정한다.

**확인 우선순위** (미확인 항목이 몰려 있는 곳):

- `URBTY_OFCTL` / `PBL_PVT_RENT` / `OPT` 의 실제 payload — 필드명은 스펙으로 확정됐지만 실측 샘플이 없다
- `CMPET_RATE`에 `△` 등 비수치 값이 실제로 들어오는지
- `HOUSE_TY`가 (A)(B)에서 바이트 단위로 일치하는지 → 조인 키 선택 검증
- R-ONE **공동주택 실거래가격지수 `STATBL_ID`** (통계코드 검색에서 확보)
- R-ONE **시도별 `CLS_ID`** 17개 + 전남광주통합 반영 여부
- R-ONE `START_WRTTIME` / `END_WRTTIME` 실제 동작 여부

각 Phase 끝에서 **브라우저로 확인하고 커밋한다.**

#### Phase 8 작업 순서 — 의존이 실제로 있다

체크리스트 본체는 [API-FIELDS.md](./API-FIELDS.md) 말미의 24개 항목이다(소스별 미확인 사항).
아래는 **Phase 1~7 리뷰에서 누적된 9건**과 그 선후관계다.

```
[키 없이 지금 가능]
  market 상류 실패가 500 — 502로 매핑할지 판단
  NoticeTable 페이지 리셋 의존성 (관심 11건 이상에서 10분마다 1페이지 복귀)

[카카오 키만 있으면 가능 — 별도 축, 가장 먼저 끊어낼 조각]
  지오코딩 성공 경로 검증
  └ 이 프로젝트에서 한 번도 검증되지 않은 유일한 주요 경로다
  └ data.go.kr·R-ONE과 발급 경로가 완전히 달라 나머지를 기다릴 이유가 없다
  └ 주소 전처리(괄호 1회 제거로 충분한지) 판단의 절반도 여기서 나온다

[실호출이 선행돼야 하는 것]
  (C) 실거래 STATBL_ID + 시도 CLS_ID 17개
      └→ lib/config.ts의 null 상수 18개 채우기
          └→ RegionMarket 첫 실검증            ★ 강한 의존
  (C) START/END_WRTTIME 실제 동작 여부
      └→ clamp-first 오탐 확인 (이력 짧은 통계표)
  (B) 8개 오퍼레이션 실제 raw JSON
      └→ SupplyRow.competition 배열 전환       ★ 행 조합을 모르면 판단 불가
  (A) 실제 payload
      └→ HSSPLY_ADRES 분포 → 주소 전처리 재판단
          현재: 말미 괄호를 반복 제거하고 그 뒤 말미 "일원"을 제거한다.
          관심사는 "괄호 1개로 충분한가"가 아니라 **"일원이 괄호 뒤에 오는 형태가 있는가"**다
          — `"강남구 (A) 일원"`은 현재 괄호가 벗겨지지 않는다.
          `(구)정자동` 같은 말미 아닌 괄호는 보존되는 것이 맞다(실제 주소 표기).

[상시 규칙 — 작업 항목이 아니다]
  픽스처 교체는 19개만 (test/fixtures/dev/ 3개는 상태 재현용)
  픽스처 분기는 항상 상류 호출 앞단 (새 클라이언트를 추가할 때마다)
```

**강한 의존 둘은 순서를 지켜야 한다.**

1. **상수 18개 → RegionMarket 검증을 바로 붙여라.** 채우면 **코드 변경 없이** 살아나는 것이
   설계 전제다. 사이에 다른 변경이 끼면 "상수만 채웠는데 안 된다"의 원인을 가를 수 없다.
2. **경쟁률 배열 전환은 실제 행 조합을 보기 전에 손대지 마라.** 타입을 넓히는 것 자체는
   쉽지만, 대표값 규칙을 유지할지 표로 펼칠지는 순위 × 거주지역이 몇 개씩 오는지를 봐야
   정해진다. 지금 바꾸면 **추측이 타입에 박힌다**(부록 27).

### 배포 (Vercel)

환경변수는 Vercel 프로젝트 설정에 넣는다(`ODCLOUD_SERVICE_KEY`, `REB_STAT_API_KEY`,
`NEXT_PUBLIC_KAKAO_MAP_KEY`). Data Cache와 `next.revalidate`가 그대로 동작한다.
`/api/health`로 키 주입을 확인한다.

**세 키 모두 값을 바꾸면 재배포가 필요하다.** Vercel은 환경변수를 **배포에 바인딩**하므로
프로젝트 설정만 고치면 이미 배포된 함수에 반영되지 않는다. 클라이언트 키는 번들에
인라인되어 재빌드 없이는 어떤 방법으로도 못 바꾸고, 서버 키는 재배포만으로 적용된다.
로컬 `pnpm start`에서는 서버 키가 정말로 런타임이라 재시작만으로 반영된다 — **이 차이가
"로컬에서 되는데 배포에서 안 되는" 전형적 원인이다.**

절차와 체크리스트는 [DEPLOY.md](./DEPLOY.md)에 있다.

---

## 12. 확장 과제

- AI 분석 (§13)
- 알림 — 관심 공고 마감 임박 시 텔레그램/슬랙
- 실거래가 개별 거래 조회 (국토부 실거래가 API)
- 스케줄 수집 · DB 적재 — 현재는 요청 시 프록시 + 캐시 방식이다.
  공고 이력을 길게 쌓거나 마감된 공고의 경쟁률을 장기 분석하려면 필요해진다.

---

## 13. AI 분석 추가 시

이번 범위에서 AI 분석은 제외했다(유료 API). **나중에 추가할 때 기존 코드를 고치지 않도록
자리만 비워뒀다.**

- `AISection` 컴포넌트가 이미 NoticeDetail 하단에 있다. 현재는 플레이스홀더만 렌더한다.
- AI 관련 라우트 · 의존성 · 환경변수는 **지금 만들지 않는다.**

### 필드는 이미 갖춰져 있다

상세 응답 + 경쟁률 + 지역 통계 JSON을 **그대로 프롬프트 입력으로 쓸 수 있게** 설계했다:

| 입력 | 출처 | 담긴 정보 |
|---|---|---|
| 공고 상세 | `GET /api/notices/{id}` | 일정, 주택형별 공급·분양가, 규제 플래그, 총 세대 |
| 경쟁률·가점 | `GET /api/notices/{id}/competition` | 순위·거주지역별 경쟁률, 당첨가점 최저·최고·평균 |
| 지역 시세 | `GET /api/market/*` | 매매·전세·실거래 지수 36개월 + mom/yoy |

세 응답이 모두 **정규화된 타입**이고 날짜는 ISO, 금액은 만원 단위 숫자, 지역은 17개 축약형으로
통일돼 있다. raw 필드가 섞여 있지 않으므로 프롬프트에 그대로 직렬화해 넣을 수 있다.

추가 시 작업은 **라우트 하나(`/api/notices/{id}/analysis`)와 `AISection` 내부**뿐이다.

---

## 부록: 스펙 초안과 실제 API가 달랐던 지점

설계 전 웹 조사(공식 OAS 스펙 원문 + 실제 API 호출)에서 드러난 차이와 그 결론이다.
Phase 8에서 다시 확인할 때 기준으로 쓴다.

| # | 스펙 초안 | 실제 | 결론 |
|---|---|---|---|
| 1 | 임의공급 오퍼레이션명 미확정 | `getOPTLttotPblancDetail` / `Mdl` | 확정, 5개 유형 전부 Detail/Mdl 쌍 존재 |
| 2 | 규제정보에 전매제한·재당첨제한·청약과열지역 | **해당 필드 없음**. APT에만 8개 Y/N 플래그 | 8개만 표시 + 공고문 안내. APT 외 섹션 숨김 |
| 3 | SupplyTable에 전용면적 | APT는 **공급면적만**, 오피스텔·민간임대는 전용면적만 | 한 열 + 헤더 라벨 전환, 환산 안 함 |
| 4 | 타임라인 고정 6단계 | APT 접수 윈도우 **최대 8개** | 존재하는 윈도우로 생성, 순위로 묶고 지역은 보조표기 |
| 5 | `YYYYMMDD`는 임의공급만 | **공공지원 민간임대도** `YYYYMMDD` | `formatCondDate(type, date)`로 유형별 처리 |
| 6 | 공고번호 + 주택형으로 조인 | `MODEL_NO`가 양쪽에 있고 더 안전. 주택형 일치는 미실증 | `MODEL_NO` 우선, `houseTypeKey` 폴백 |
| 7 | R-ONE sample 응답 **10건** | **5건** (`pSize` 무시) | 임계값 5로 가드 |
| 8 | 인증키 오류 코드 `INFO-100` | **`ERROR-290`** | 그대로 매핑. 정상은 `INFO-000` 맞음 |
| 9 | `Type=json`인데 xml 에러 | 재현 안 됨 | xml 폴백은 방어로 유지 |
| 10 | 통계 지역이 (A)와 다름 | 최상위 세그먼트는 **같은 축약형**. 단 다단계 트리 | 매핑 테이블 유지, `CLS_ID`는 Phase 8에 확보 |
| 11 | `/api/market/price-index`가 전세를 내리는데 쓰는 화면 없음 | — | RegionMarket 3번째 라인으로 사용 |
| 12 | `Notice.id` = 공고번호 | Mdl 조인에 `HOUSE_MANAGE_NO`도 필요 | `houseManageNo` 별도 보존, URL은 `PBLANC_NO`만 |

### Phase 1 구현 중 추가로 드러난 것

| # | 설계 | 실제 | 결론 |
|---|---|---|---|
| 13 | `NoticeStatus` 3값 | 접수 종료일이 없는 공고가 영구 `open` + `dday: null` | `'unknown'` 추가. 판정 원칙을 "**종료일 없으면 판정 불가**"로 — "둘 다 null"로 잡으면 시작일만 있는 케이스가 새어나간다. 쿼리 필터 enum은 3값 유지 |
| 14 | D-day를 요청 시각 기준 계산 | `date-fns`가 **서버 로컬 캘린더**를 쓴다 → `TZ=UTC` 배포 시 하루 오차 | `todayInSeoul()` 도입, 테스트를 `TZ=UTC`로 실행 |
| 15 | `Notice.minPrice`/`maxPrice` | 가격이 Detail에 없고 Mdl에만 있다. Mdl은 배치 조회 불가 | 목록은 항상 `null`, 상세만 채움. Dashboard는 보이는 행만 지연 조회 |
| 16 | `dedupe()` 있으면 동시 요청 합류 | Next의 자동 합류는 **단일 요청 내** request memoization뿐. 별개 핸들러 호출 간에는 없다. `dedupe` 맵은 **프로세스 단위**라 서버리스 인스턴스별로만 합쳐진다 | 상류 호출 경로에 실제로 배선. 전역 1회가 아니라 인스턴스 내 중복 제거 장치로 기대치 설정 |
| 17 | `region` 쿼리 검증 | 자유 문자열이면 `?region=서울특별시` 오타가 400이 아니라 조용히 0건 | 17개 화이트리스트 `z.enum` 검증 → 400 |
| 18 | odcloud 헤더 인증이 `Authorization: {key}` | **`Infuser` 접두어 필수.** 접두어 없으면 유효한 키도 `-401`(키 없음)로 고정 — 키 없음과 구분되지 않는다 | `Authorization: Infuser ${key}`. 더미 키 curl로 확정(`-401`→`-4` 전이가 파싱 경계). 단위 테스트로는 잡히지 않는다 |

### Phase 2 구현 중 드러난 것

| # | 설계 | 실제 | 결론 |
|---|---|---|---|
| 19 | 탭은 유형 4종 + 관심 | 전체 뷰가 없어 `OPT`가 표에 안 뜨고 관심 등록 진입점도 없다 | "전체" 탭 추가, 기본 활성. 유형 탭이 4개라는 뜻으로 해석 |
| 20 | `summary`는 region·type 반영 | 요약·카드가 별도 무필터 쿼리로 빠져 필터에 반응하지 않았다 | 테이블과 **같은 쿼리 하나**를 공유. 관심 탭만 예외(클라이언트 필터) |
| 21 | `/api/health`는 키 존재 여부 | 픽스처 모드가 `keys.odcloud`를 `true`로 위장했다 | `keys.*`는 실제 env만. 픽스처 여부는 `fixtures` 필드로 분리 |
| 22 | 픽스처 날짜 시프트 | `/^\d{8}$/`가 전화번호 `16001004`를 `1600-10-04`로 파싱해 변조. 비날짜 8자리는 `RangeError` → 500 | 연도 범위로 걸러냄. 회귀 테스트 2건을 §4.6 예외로 추가 |
| 23 | `staleTime`을 상세 TTL 30분과 맞춘다 | `gcTime` 기본값이 **5분**이라 캐시가 stale 되기 전에 수거된다 → 30분이 의도만 남음 | `gcTime`도 `CACHE_TTL.noticeDetail`로 맞춘다 |

### Phase 3 구현 중 드러난 것

| # | 설계 | 실제 | 결론 |
|---|---|---|---|
| 24 | 타임라인 단계 순서에 `all`이 없었다 | `all`을 버리면 `URBTY_OFCTL`/`PBL_PVT_RENT`의 접수기간이 통째로 사라지고, 항상 그리면 `REMNDR`에서 `general`과 날짜가 겹쳐 같은 단계가 두 번 나온다 | `all`을 **폴백으로만** 쓴다 — 구체적 윈도우가 없을 때만 "청약접수"로 렌더 |
| 25 | 규제 플래그는 `Y`인 것만 칩으로 | 전부 `N`인 공고는 빈 박스가 된다 | "해당하는 규제가 없습니다." 표시 + `note` 유지. 규제 없음도 정보다 |
| 26 | 회귀 테스트를 `toMatch(/^\d{8}$/)`로 고쳤다 | **시프트가 안 돼도 형식은 맞아 통과한다.** 한 구멍을 막으며 다른 구멍을 열었다 | `shiftDays()`를 export해 기대값을 계산하고 `toBe`로 비교 |

### Phase 4 구현 중 드러난 것

| # | 설계 | 실제 | 결론 |
|---|---|---|---|
| 27 | `SupplyRow.competition`을 단수(`CompetitionRow`)로 타이핑 | 경쟁률은 **순위 × 거주지역 다차원**이라 단수로 못 담는다 | 대표값 1개 + 보조표기로 우회. 배열 전환은 Phase 8(실제 행 조합 확인 후) |
| 28 | `resideArea`가 정규화된 값이라고 전제 | `RESIDE_SENM` **원문 그대로**였다. `=== '해당지역'` 비교가 표시 문자열에 로직을 걸고 있었다 — 표기가 바뀌면 조용히 무력화 | `RESIDE_SECD`에서 `resideKind` 도출. §4.0에 판단 기준을 원칙으로 박았다 |
| 29 | 픽스처 모드가 (B) 오퍼레이션도 서비스한다고 전제 | `OPERATION_FIXTURE_FILE`에 (A) 10개만 있어 (B)는 `return []` → **조용한 전 유형 204** | `COMPETITION_OPERATION_FIXTURE_FILE` + `test/fixtures/competition/` 추가 |

### Phase 5 구현 중 드러난 것

| # | 설계 | 실제 | 결론 |
|---|---|---|---|
| 30 | 조인 순수 함수를 `competition.ts`에 두라고 지시 | 그 파일이 `fetchOdcloudAll` → `fixtures.ts` → `node:fs`/`node:path`를 끌고 오는 **서버 전용 모듈**이라, 클라이언트 컴포넌트가 값으로 import하면 `UnhandledSchemeError: node:path`로 빌드가 깨진다 | `competitionJoin.ts`로 분리. 타입만 `import type`으로 참조. **서버 전용 모듈과 클라이언트가 공유할 순수 함수는 파일을 갈라야 한다** |
| 31 | `ReferenceLine y={100}`으로 기준선 표시 | recharts `domain={['auto','auto']}`가 데이터 범위만 보고 축을 잡아 **100이 잘려 기준선이 안 보인다**. 코드만 읽으면 통과로 보인다 | Y축 도메인이 데이터 min/max와 100을 항상 함께 포함하게 한다 |
| 32 | MarketStrip은 "선택 지역" | `RegionFilter`가 멀티 선택이라 첫 지역을 고르면 임의적이다 | 정확히 하나일 때만 그 지역, 그 외는 `전국` |
| 33 | market 503이 3종 | 동시에 성립할 때의 순서가 명세에 없었다 | 키 없음 → 통계표 미확정 → 지역 미매핑 (가장 실행 가능한 원인 먼저) |
| 34 | 차트 색을 `@theme` 토큰으로 정의 | 매매에 전용 토큰(`--color-series-sale`)을 두자 MarketStrip(`--color-line`)과 **같은 지수가 화면마다 다른 색**이 됐다. 토큰 참조 형식은 지켰지만 값이 갈렸다 | 매매는 `--color-line`을 공용한다. 신규 토큰은 전세·실거래 2개만 |
| 35 | §4.5⑤ "어댑터에서 항상 요청 기간으로 잘라낸다" | `clampToRange`가 **픽스처 경로에만** 배선돼 프로덕션에서만 `months`가 무효였다. 테스트·브라우저·빌드 전부 통과 | 원격 경로에 배선하고 **`isSampleResponse`보다 먼저** 실행한다(§4.5① 표 참조). 픽스처 early return은 유지 |

### Phase 6 구현 중 드러난 것

| # | 설계 | 실제 | 결론 |
|---|---|---|---|
| 36 | `ScoreInput.accountYears` | 구간표가 "6개월 미만 / 6개월~1년"으로 시작해 **연 단위로는 표현 불가**. `0.5`로 쓰면 부동소수 비교가 로직에 들어간다 | `accountMonths`로 변경 |
| 37 | 총점이 0부터 시작한다고 전제 | 최저 구간이 각각 2·5·1점이라 **모든 입력이 0이어도 8점**이다. `{0,0,0}`으로 초기화하고 배지를 그리면 입력하지 않은 사용자에게 "내 가점 8점"이 뜬다 | `useScore` 초기값을 `null`로. `loaded` 플래그로 "미로드"와 "미저장"을 구분 |
| 38 | §10 예시 문구 "이 주택형 최저 당첨" | 배지는 **공고 헤더에 하나만** 뜨는데 값은 모든 주택형의 최솟값이다 — 어느 주택형인지 틀리게 말한다 | 라벨을 "이 공고 최저 당첨"으로. 주택형별 비교는 SupplyTable 열이 담당 |

---

## 부록: 조사하지 말 것

**`RegionFilter` 체크박스의 `style={{}}` 하이드레이션 경고 — 브라우저 확장 때문이다.** 두 번 조사했다.

근거:
- 코드베이스 전체에 `style=` prop이 **0건**이다(`app`·`components`·`hooks`·`lib`). `RegionFilter`의 input은 `className="sr-only"`뿐이라 프로젝트 코드에서 나올 수 없다.
- **클린 헤드리스 Chromium에서 재현 0건** — 대시보드 진입 → 필터 클릭 2회 → 새로고침까지 확인.
- `style={{}}`가 **폼 컨트롤**에 붙는 형태는 비밀번호 관리자·자동완성 확장이 하이드레이션 전에 DOM을 건드릴 때 나오는 전형이다.

**재발 시 판별법**: 확장을 끈 새 프로필에서 재현되면 실제 문제, 안 되면 확장이다.
**그 한 번으로 끝내라.**

### Phase 7 구현 중 드러난 것

| # | 설계 | 실제 | 결론 |
|---|---|---|---|
| 39 | 지도 섹션을 렌더해두고 `hidden`으로 숨겼다가 보인다 | `hidden`은 `display: none`이라 **컨테이너가 0×0인 상태에서 지도가 생성**된다. 타일·중심이 0×0 기준으로 계산돼 보이게 해도 빈 박스로 남는다(`relayout()` 필요) | 지오코딩은 컨테이너가 필요 없다 → **좌표를 먼저 받고, 좌표가 있을 때만 섹션을 렌더하고, 그 다음 지도를 만든다.** 검증할 수 없는 경로의 위험을 구조로 제거 |
| 40 | 서버 키는 런타임에 읽으므로 재배포 불필요 | Next.js 의미론으로는 맞지만 **Vercel은 env를 배포에 바인딩**한다. 프로젝트 설정만 고치면 이미 배포된 함수에 반영되지 않는다 | 세 키 모두 "재배포 필요". 이유 구분(인라인 vs 바인딩)과 로컬과의 차이는 남긴다 |
