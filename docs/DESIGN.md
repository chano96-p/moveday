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
    competition.ts                  경쟁률·당첨가점 조회 + SupplyRow 조인
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

---

## 3. 데이터 소스 3종

규격과 인증키가 서로 다르므로 클라이언트를 분리한다.

| | (A) 분양정보 | (B) 경쟁률·특별공급 | (C) 부동산통계 |
|---|---|---|---|
| 포털 ID | data.go.kr 15098547 | data.go.kr 15098905 | R-ONE (15134761) |
| base URL | `https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1` | `https://api.odcloud.kr/api/ApplyhomeInfoCmpetRtSvc/v1` | `https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do` |
| 인증 | `serviceKey` 쿼리 또는 `Authorization` 헤더 | 동일 | `KEY` 쿼리 |
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
  minPrice: number | null       // 만원
  maxPrice: number | null       // 만원
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
  resideArea: string | null     // RESIDE_SENM
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
  toNotice(raw: unknown): Notice
  toSupplyRows(raw: unknown[]): SupplyRow[]
}

export const ADAPTERS: Record<NoticeType, NoticeAdapter> = { ... }
```

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
  "rebstatTables": { "sale": true, "jeonse": true, "realTransaction": false } }
```

**키 값은 절대 내리지 않는다.** 존재 여부 불리언만.

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

| 키 | 정의 |
|---|---|
| `open` | `status === 'open'` |
| `closingThisWeek` | `receiptEnd`가 **오늘 ~ +6일** (롤링 7일 윈도우) |
| `new` | `noticeDate`가 최근 7일 |

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
| 쿼리 검증 실패 | `400` + zod 이슈 |

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
그래서 in-flight 맵이 별도로 필요하다.

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
6. **MarketStrip** — 선택 지역(기본 전국) 아파트 매매가격지수 최근 24개월 라인 + mom/yoy 배지

### 동작

- 행 클릭 → `/notices/{id}?type={type}`
- **관심 공고**: `localStorage`에 **id만** 저장. 상단 "관심" 탭에서 모아본다.
  `useFavorites()`는 SSR 안전하게 `useEffect` 이후에 읽는다(하이드레이션 불일치 방지).
- react-query `refetchInterval: 600_000`, `staleTime: 600_000` — 10분 자동 갱신.
- 임의공급(`OPT`)은 별도 탭을 두지 않고 전체 목록에 포함한다(스펙의 탭 4종을 유지).
- **통계 키가 없으면 MarketStrip만 사라진다.** 나머지는 정상 동작한다.

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

### SupplyTable

**면적은 한 열, 헤더 라벨을 유형에 따라 전환한다.**

| 유형 | 헤더 |
|---|---|
| `APT` / `REMNDR` / `OPT` | 공급면적 |
| `URBTY_OFCTL` / `PBL_PVT_RENT` | 전용면적 |

같은 통에 다른 개념을 섞지 않고, 환산 추정도 하지 않는다.
경쟁률·당첨가점 열은 **데이터가 있을 때만** 렌더한다.

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

### RegionMarket

해당 지역의 **아파트 매매가격지수 · 아파트 전세가격지수 · 공동주택 실거래가격지수** 36개월 추이.

설명 문구:

> 분양가가 시세 흐름 대비 어느 수준인지 판단할 맥락입니다.

각주:

> 지수는 기준시점을 100으로 한 상대값입니다. 절대 가격이 아닙니다.

3개 라인이 겹치므로 여기서만 상색으로 구분한다(단색 원칙의 유일한 예외).
`실거래가격지수`는 통계표 코드가 미확정이므로 해당 시리즈만 빠진 상태로 렌더될 수 있다.

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
export interface ScoreInput { noHouseYears: number; dependents: number; accountYears: number }
export function calcScore(input: ScoreInput): {
  total: number
  breakdown: { noHouse: number; dependents: number; account: number }
}
```

- 입력 폼은 **전용 `/score` 페이지**, 전역 헤더에서 링크한다.
- 값은 `localStorage`에 저장한다(`useScore()`, SSR 안전).
- 상세 화면 상단에는 **배지만** 노출한다.
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

### 배포 (Vercel)

환경변수는 Vercel 프로젝트 설정에 넣는다(`ODCLOUD_SERVICE_KEY`, `REB_STAT_API_KEY`,
`NEXT_PUBLIC_KAKAO_MAP_KEY`). Data Cache와 `next.revalidate`가 그대로 동작한다.
`/api/health`로 키 주입을 확인한다.

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
