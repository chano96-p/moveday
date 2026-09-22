# API 필드 매핑 원본

[DESIGN.md](./DESIGN.md)의 정규화 계층이 참조하는 raw 필드 목록.
어댑터를 작성·수정할 때와 Phase 8에서 실제 응답과 대조할 때 쓴다.

- 조사 기준일: 2026-09-22
- 신뢰도 표기: **[확정]** = 공식 OAS 스펙 원문 또는 실제 API 호출로 확인 /
  **[미확인]** = 문서에 없거나 실측하지 못한 것

## 출처

| 소스 | 1차 출처 |
|---|---|
| (A) 분양정보 | `https://infuser.odcloud.kr/api/stages/37000/api-docs` (odcloud 공식 OAS 원문) |
| (B) 경쟁률 | `https://infuser.odcloud.kr/oas/docs?namespace=ApplyhomeInfoCmpetRtSvc/v1` |
| (C) 부동산통계 | `https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do` 직접 호출 + 개발가이드 |

교차 검증: `github.com/dbwith00-coder/jipdang-cheongyak` (2026-09-22 라이브 캡처),
`github.com/earthskyisbig/apt-lottery`, `github.com/hhkim17/seoul-cheongyak`

---

# (A) 청약홈 분양정보 — 15098547

base: `https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1`

## 공통 규격 [확정]

**인증** — 둘 다 지원 (`securityDefinitions`)

- 쿼리 파라미터 `serviceKey`
- 헤더 `Authorization`

키 오류 응답 (HTTP 401):

```json
{"code":-401,"msg":"인증키는 필수 항목 입니다."}   // 키 없음
{"code":-4,"msg":"등록되지 않은 인증키 입니다."}    // 잘못된 키
```

**공통 파라미터**: `page` (기본 1), `perPage` (기본 10), `returnType` (기본 JSON, `XML` 가능)

**필터 문법**: `cond[필드명::연산자]=값`
연산자: `EQ`(=), `LT`(<), `LTE`(<=), `GT`(>), `GTE`(>=), `LIKE`

**응답 래퍼** — 10개 오퍼레이션 전부 동일

```json
{ "page": 1, "perPage": 10, "totalCount": 0,
  "currentCount": 0, "matchCount": 0, "data": [ { } ] }
```

`totalCount`는 필터 미반영일 수 있고 `matchCount`가 `cond` 반영 건수다.
페이징 종료는 `data.length < perPage` 로 판단한다.

**Detail ↔ Mdl 조인 키**: `HOUSE_MANAGE_NO` + `PBLANC_NO` (둘 다 필요)

## 오퍼레이션별 지원 필터 [확정]

| 오퍼레이션 | `cond` 지원 필드 |
|---|---|
| `getAPTLttotPblancDetail` | `HOUSE_MANAGE_NO::EQ`, `PBLANC_NO::EQ`, `HOUSE_NM::LIKE`, `HOUSE_SECD::EQ`, `HOUSE_DTL_SECD::EQ`, `SUBSCRPT_AREA_CODE::EQ`, `SUBSCRPT_AREA_CODE_NM::EQ`, `HSSPLY_ADRES::LIKE`, `RCRIT_PBLANC_DE::{LT,LTE,GT,GTE}` |
| `getUrbtyOfctlLttotPblancDetail` | `HOUSE_MANAGE_NO::EQ`, `PBLANC_NO::EQ`, `HOUSE_NM::LIKE`, `SEARCH_HOUSE_SECD::EQ`, `SUBSCRPT_AREA_CODE::EQ`, `HSSPLY_ADRES::LIKE`, `RCRIT_PBLANC_DE::{LT,LTE,GT,GTE}` |
| `getRemndrLttotPblancDetail` | `HOUSE_MANAGE_NO::EQ`, `PBLANC_NO::EQ`, `HOUSE_NM::LIKE`, `HOUSE_SECD::EQ`, `SUBSCRPT_AREA_CODE::EQ`, `HSSPLY_ADRES::LIKE`, `RCRIT_PBLANC_DE::{LT,LTE,GT,GTE}` |
| `getPblPvtRentLttotPblancDetail` | `HOUSE_MANAGE_NO::EQ`, `PBLANC_NO::EQ`, `HOUSE_NM::LIKE`, `HOUSE_SECD::EQ`, `HSSPLY_ADRES::LIKE`, `RCRIT_PBLANC_DE::{LT,LTE,GT,GTE}` — **지역 필터 없음** |
| `getOPTLttotPblancDetail` | `HOUSE_MANAGE_NO::EQ`, `PBLANC_NO::EQ`, `HOUSE_NM::LIKE`, `SUBSCRPT_AREA_CODE::EQ`, `HSSPLY_ADRES::LIKE`, `RCRIT_PBLANC_DE::{LT,LTE,GT,GTE}` |
| **Mdl 5개 전부** | `HOUSE_MANAGE_NO::EQ`, `PBLANC_NO::EQ` 뿐 (날짜·지역 필터 없음) |

`SUBSCRPT_AREA_CODE_NM::EQ`(축약 지역명)는 **APT Detail만** 지원한다.
`SUBSCRPT_AREA_CODE`(숫자) 값은 `410`=경기만 실측 확인됐고 나머지는 **[미확인]**.
→ 지역 필터는 상류로 넘기지 않고 우리 코드에서 적용한다.

## 날짜 형식 [확정]

| 오퍼레이션 | `RCRIT_PBLANC_DE` 및 기타 날짜 |
|---|---|
| `getAPTLttotPblancDetail` | `YYYY-MM-DD` |
| `getUrbtyOfctlLttotPblancDetail` | `YYYY-MM-DD` |
| `getRemndrLttotPblancDetail` | `YYYY-MM-DD` |
| **`getPblPvtRentLttotPblancDetail`** | **`YYYYMMDD`** |
| **`getOPTLttotPblancDetail`** | **`YYYYMMDD`** |
| `MVN_PREARNGE_YM` (전 유형) | `YYYYMM` |

금액 필드(`LTTOT_TOP_AMOUNT`, `SUPLY_AMOUNT`, `SUBSCRPT_REQST_AMOUNT`)는
스키마상 `string`, 단위는 **만원**. 실측은 쉼표 없는 `"36707"`.

---

## A-1. `getAPTLttotPblancDetail` — APT 일반분양

| 한글 | 필드 | 비고 |
|---|---|---|
| 주택관리번호 | `HOUSE_MANAGE_NO` | |
| 공고번호 | `PBLANC_NO` | `Notice.id` |
| 주택명 | `HOUSE_NM` | |
| 주택구분코드 | `HOUSE_SECD` | 01 APT / 09 민간사전청약 / 10 신혼희망타운 |
| 주택구분코드명 | `HOUSE_SECD_NM` | |
| 주택상세구분코드 | `HOUSE_DTL_SECD` | 01 민영 / 03 국민 |
| 주택상세구분코드명 | `HOUSE_DTL_SECD_NM` | |
| 분양구분코드 | `RENT_SECD` | 0 분양주택 / 1 분양전환가능임대 |
| 분양구분코드명 | `RENT_SECD_NM` | |
| 공급지역코드 | `SUBSCRPT_AREA_CODE` | |
| 공급지역명 | `SUBSCRPT_AREA_CODE_NM` | **축약형** ("경기") |
| 공급위치 우편번호 | `HSSPLY_ZIP` | |
| 공급위치 주소 | `HSSPLY_ADRES` | 지오코딩 입력 |
| 총 공급세대수 | `TOT_SUPLY_HSHLDCO` | integer |
| 모집공고일 | `RCRIT_PBLANC_DE` | |
| 신문사 | `NSPRC_NM` | |
| 청약접수 시작/종료일 | `RCEPT_BGNDE` / `RCEPT_ENDDE` | 전체 윈도우 |
| 특별공급 접수 시작/종료일 | `SPSPLY_RCEPT_BGNDE` / `SPSPLY_RCEPT_ENDDE` | |
| 1순위 해당지역 시작/종료 | `GNRL_RNK1_CRSPAREA_RCPTDE` / `GNRL_RNK1_CRSPAREA_ENDDE` | |
| 1순위 기타경기 시작/종료 | `GNRL_RNK1_ETC_GG_RCPTDE` / `GNRL_RNK1_ETC_GG_ENDDE` | |
| 1순위 기타지역 시작/종료 | `GNRL_RNK1_ETC_AREA_RCPTDE` / `GNRL_RNK1_ETC_AREA_ENDDE` | |
| 2순위 해당지역 시작/종료 | `GNRL_RNK2_CRSPAREA_RCPTDE` / `GNRL_RNK2_CRSPAREA_ENDDE` | |
| 2순위 기타경기 시작/종료 | `GNRL_RNK2_ETC_GG_RCPTDE` / `GNRL_RNK2_ETC_GG_ENDDE` | |
| 2순위 기타지역 시작/종료 | `GNRL_RNK2_ETC_AREA_RCPTDE` / `GNRL_RNK2_ETC_AREA_ENDDE` | |
| 당첨자발표일 | `PRZWNER_PRESNATN_DE` | |
| 계약 시작/종료일 | `CNTRCT_CNCLS_BGNDE` / `CNTRCT_CNCLS_ENDDE` | |
| 홈페이지주소 | `HMPG_ADRES` | |
| 시공사 | `CNSTRCT_ENTRPS_NM` | APT에만 존재 |
| 문의처 | `MDHS_TELNO` | |
| 사업주체명 | `BSNS_MBY_NM` | |
| 입주예정월 | `MVN_PREARNGE_YM` | `YYYYMM` |
| 공고문 URL | `PBLANC_URL` | |

### 규제 플래그 — APT Detail에만 존재, 전부 `Y`/`N` [확정]

| 필드 | 라벨 |
|---|---|
| `SPECLT_RDN_EARTH_AT` | 투기과열지구 |
| `MDAT_TRGET_AREA_SECD` | 조정대상지역 (Y 과열지역 / N 미대상) |
| `PARCPRC_ULS_AT` | 분양가상한제 |
| `IMPRMN_BSNS_AT` | 정비사업 |
| `PUBLIC_HOUSE_EARTH_AT` | 공공주택지구 |
| `LRSCL_BLDLND_AT` | 대규모 택지개발지구 |
| `NPLN_PRVOPR_PUBLIC_HOUSE_AT` | 수도권 내 민영 공공주택지구 |
| `PUBLIC_HOUSE_SPCLW_APPLC_AT` | 공공주택 특별법 적용 |

> **"전매제한" · "재당첨제한" · "청약과열지역" 필드는 10개 오퍼레이션 어디에도 없다.**
> 스펙 원문 전문 검색 결과 0건. 나머지 4개 유형 Detail에는 규제 플래그가 전무하다.

### 실제 응답 샘플 [확정 — 2026-09-22 라이브 캡처]

```json
{
  "HOUSE_MANAGE_NO": "2026820011",
  "PBLANC_NO": "2026820011",
  "HOUSE_NM": "시흥하중지구 A-4블록 신혼희망타운(공공분양) 추가입주자모집",
  "HOUSE_SECD": "10", "HOUSE_SECD_NM": "신혼희망타운",
  "HOUSE_DTL_SECD": "03", "HOUSE_DTL_SECD_NM": "국민",
  "RENT_SECD": "0", "RENT_SECD_NM": "분양주택",
  "SUBSCRPT_AREA_CODE": "410", "SUBSCRPT_AREA_CODE_NM": "경기",
  "HSSPLY_ZIP": "14972",
  "HSSPLY_ADRES": "경기도 시흥시 하중동 일원 (시흥하중 공공주택지구 내 A-4블록)",
  "TOT_SUPLY_HSHLDCO": 61,
  "RCRIT_PBLANC_DE": "2026-09-18",
  "RCEPT_BGNDE": "2026-09-28", "RCEPT_ENDDE": "2026-09-29",
  "SPSPLY_RCEPT_BGNDE": null, "SPSPLY_RCEPT_ENDDE": null,
  "GNRL_RNK1_CRSPAREA_RCPTDE": "2026-09-28", "GNRL_RNK1_CRSPAREA_ENDDE": "2026-09-28",
  "GNRL_RNK1_ETC_GG_RCPTDE": null, "GNRL_RNK1_ETC_GG_ENDDE": null,
  "GNRL_RNK1_ETC_AREA_RCPTDE": "2026-09-28", "GNRL_RNK1_ETC_AREA_ENDDE": "2026-09-28",
  "GNRL_RNK2_CRSPAREA_RCPTDE": "2026-09-29", "GNRL_RNK2_CRSPAREA_ENDDE": "2026-09-29",
  "PRZWNER_PRESNATN_DE": "2026-10-08",
  "CNTRCT_CNCLS_BGNDE": "2026-12-29", "CNTRCT_CNCLS_ENDDE": "2026-12-30",
  "HMPG_ADRES": "https://www.apply.lh.or.kr",
  "CNSTRCT_ENTRPS_NM": "한신공영(주)",
  "MDHS_TELNO": "16001004",
  "BSNS_MBY_NM": "한국토지주택공사 경기남부지역본부",
  "MVN_PREARNGE_YM": "202807",
  "SPECLT_RDN_EARTH_AT": "N", "MDAT_TRGET_AREA_SECD": "N", "PARCPRC_ULS_AT": "Y",
  "IMPRMN_BSNS_AT": "N", "PUBLIC_HOUSE_EARTH_AT": "Y",
  "LRSCL_BLDLND_AT": "N", "NPLN_PRVOPR_PUBLIC_HOUSE_AT": "N",
  "PUBLIC_HOUSE_SPCLW_APPLC_AT": "Y",
  "PBLANC_URL": "https://www.applyhome.co.kr/ai/aia/selectAPTLttotPblancDetail.do?houseManageNo=2026820011&pblancNo=2026820011",
  "NSPRC_NM": null
}
```

**주의**: `SPSPLY_RCEPT_*`가 `null`이고 1순위 기타경기도 `null`이다.
접수 윈도우는 항상 8개가 다 오지 않는다 → 어댑터는 `null` 윈도우를 걸러내야 한다.

---

## A-2. `getAPTLttotPblancMdl` — APT 주택형별

| 한글 | 필드 |
|---|---|
| 주택관리번호 / 공고번호 / 모델번호 | `HOUSE_MANAGE_NO` / `PBLANC_NO` / `MODEL_NO` |
| 주택형 | `HOUSE_TY` |
| **공급면적** | `SUPLY_AR` |
| 일반공급세대수 | `SUPLY_HSHLDCO` |
| 특별공급세대수 (합계) | `SPSPLY_HSHLDCO` |
| 공급금액 (분양최고금액, 만원) | `LTTOT_TOP_AMOUNT` |

### 특별공급 세부

| 한글 | 필드 |
|---|---|
| 다자녀가구 | `MNYCH_HSHLDCO` |
| 신혼부부 | `NWWDS_HSHLDCO` |
| 생애최초 | `LFE_FRST_HSHLDCO` |
| 노부모부양 | `OLD_PARNTS_SUPORT_HSHLDCO` |
| 기관추천 | `INSTT_RECOMEND_HSHLDCO` |
| 이전기관 | `TRANSR_INSTT_ENFSN_HSHLDCO` |
| 청년 | `YGMN_HSHLDCO` (공공주택만) |
| 신생아 | `NWBB_HSHLDCO` (공공주택만) |
| 기타 | `ETC_HSHLDCO` |

> 청년·신생아는 `HOUSE_DTL_SECD='03'` & `PUBLIC_HOUSE_SPCLW_APPLC_AT='Y'`인 경우만 값이 있다.
> 스펙 문서는 이 조건을 `HOUSE_DETAIL_SECD`로 표기했는데 APT Detail의 실제 필드명은
> `HOUSE_DTL_SECD`다 — **공식 문서 자체의 표기 불일치**. 실제 응답 키를 기준으로 한다.

**`HOUSE_TY` 표기 [확정 — 두 형태 관측]**
스펙 문서: `"084.9500A"` / 라이브 캡처: `"55㎡O"`, `"84㎡A"`
→ `normalizeHouseType()`으로 정규화한다.

실측 값: `HOUSE_TY "55㎡O"` 1세대 (`LTTOT_TOP_AMOUNT` 36707),
`HOUSE_TY "56㎡O"` 60세대 (39358)

---

## A-3. `getUrbtyOfctlLttotPblancDetail` — 오피스텔·도시형·민간임대·생활숙박

| 한글 | 필드 |
|---|---|
| 주택관리번호 / 공고번호 / 주택명 | `HOUSE_MANAGE_NO` / `PBLANC_NO` / `HOUSE_NM` |
| 주택구분코드 / 명 | `HOUSE_SECD` (02) / `HOUSE_SECD_NM` |
| 주택상세구분코드 / 명 | `HOUSE_DTL_SECD` / `HOUSE_DTL_SECD_NM` — 01 도시형생활주택 / 02 오피스텔 / 03 민간임대 / 04 생활형숙박시설 |
| 주택구분 (검색용) | `SEARCH_HOUSE_SECD` — 0201/0202/0203/0204/0303 |
| 공급지역코드 / 명 | `SUBSCRPT_AREA_CODE` / `SUBSCRPT_AREA_CODE_NM` |
| 공급위치 우편번호 / 주소 | `HSSPLY_ZIP` / `HSSPLY_ADRES` |
| 공급규모 | `TOT_SUPLY_HSHLDCO` |
| 모집공고일 | `RCRIT_PBLANC_DE` |
| 신문사 | `NSPRC_NM` |
| **청약접수 시작/종료일** | `SUBSCRPT_RCEPT_BGNDE` / `SUBSCRPT_RCEPT_ENDDE` |
| 당첨자발표일 | `PRZWNER_PRESNATN_DE` |
| 계약 시작/종료일 | `CNTRCT_CNCLS_BGNDE` / `CNTRCT_CNCLS_ENDDE` |
| 홈페이지주소 / 사업주체명 / 문의처 | `HMPG_ADRES` / `BSNS_MBY_NM` / `MDHS_TELNO` |
| 입주예정월 | `MVN_PREARNGE_YM` |
| 공고문 URL | `PBLANC_URL` |

**없는 것**: 시공사, 1·2순위 세분화 접수일, 특별공급 접수일, 규제 플래그

## A-4. `getUrbtyOfctlLttotPblancMdl`

| 한글 | 필드 |
|---|---|
| 주택관리번호 / 공고번호 / 모델번호 | `HOUSE_MANAGE_NO` / `PBLANC_NO` / `MODEL_NO` |
| 군 / 타입 | `GP` / `TP` |
| **전용면적** | `EXCLUSE_AR` |
| 공급세대수 | `SUPLY_HSHLDCO` |
| 공급금액 (만원) | `SUPLY_AMOUNT` |
| 청약신청금 (만원) | `SUBSCRPT_REQST_AMOUNT` |

**주택형이 `HOUSE_TY` 단일 필드가 아니라 `GP` + `TP` 조합이다.**

---

## A-5. `getRemndrLttotPblancDetail` — 무순위·잔여세대

| 한글 | 필드 |
|---|---|
| 주택관리번호 / 공고번호 / 주택명 | `HOUSE_MANAGE_NO` / `PBLANC_NO` / `HOUSE_NM` |
| 주택구분코드 | `HOUSE_SECD` — **04 무순위 / 06 불법행위 재공급** |
| 주택구분코드명 | `HOUSE_SECD_NM` (실측: `"불법행위 재공급"`) |
| 공급지역코드 / 명 | `SUBSCRPT_AREA_CODE` / `SUBSCRPT_AREA_CODE_NM` |
| 공급위치 우편번호 / 주소 | `HSSPLY_ZIP` / `HSSPLY_ADRES` |
| 공급규모 | `TOT_SUPLY_HSHLDCO` |
| 모집공고일 | `RCRIT_PBLANC_DE` |
| 신문사 | `NSPRC_NM` |
| 청약접수 시작/종료일 | `SUBSCRPT_RCEPT_BGNDE` / `SUBSCRPT_RCEPT_ENDDE` |
| 특별공급 접수 시작/종료일 | `SPSPLY_RCEPT_BGNDE` / `SPSPLY_RCEPT_ENDDE` |
| 일반공급 접수 시작/종료일 | `GNRL_RCEPT_BGNDE` / `GNRL_RCEPT_ENDDE` |
| 당첨자발표일 | `PRZWNER_PRESNATN_DE` |
| 계약 시작/종료일 | `CNTRCT_CNCLS_BGNDE` / `CNTRCT_CNCLS_ENDDE` |
| 홈페이지 / 사업주체 / 문의처 / 입주예정월 / URL | `HMPG_ADRES` / `BSNS_MBY_NM` / `MDHS_TELNO` / `MVN_PREARNGE_YM` / `PBLANC_URL` |

**`HOUSE_SECD`가 경쟁률 오퍼레이션 분기 조건이다** (04 → `getRemndrLttotPblancCmpet`,
06 → `getCancResplLttotPblancCmpet`).

## A-6. `getRemndrLttotPblancMdl`

| 한글 | 필드 |
|---|---|
| 주택관리번호 / 공고번호 / 모델번호 | `HOUSE_MANAGE_NO` / `PBLANC_NO` / `MODEL_NO` |
| 모델타입 (주택형) | `HOUSE_TY` |
| **공급면적** | `SUPLY_AR` |
| 일반공급세대수 | `SUPLY_HSHLDCO` |
| 특별공급세대수 | `SPSPLY_HSHLDCO` |
| 공급금액 (만원) | `LTTOT_TOP_AMOUNT` |

### 실측 관측값 [확정 — 2026-09-22]

```
HOUSE_NM        "더샵 청주그리니티"
HOUSE_SECD_NM   "불법행위 재공급"
HSSPLY_ADRES    "충청북도 청주시 서원구 개신동"
RCRIT_PBLANC_DE "2026-09-21"
PBLANC_URL      ".../selectAPTRemndrLttotPblancDetailView.do?houseManageNo=2026930035&pblancNo=2026930035"
주택형 "84㎡A" 1세대 (35550) / "99㎡A" 1세대 (37708)
```

**공고문 URL 경로가 APT와 다르다** (`selectAPTRemndrLttotPblancDetailView.do`).
`PBLANC_URL`을 그대로 쓰고 직접 조립하지 않는다.

---

## A-7. `getPblPvtRentLttotPblancDetail` — 공공지원 민간임대

| 한글 | 필드 | 비고 |
|---|---|---|
| 주택관리번호 / 공고번호 / 주택명 | `HOUSE_MANAGE_NO` / `PBLANC_NO` / `HOUSE_NM` | |
| 주택구분코드 / 명 | `HOUSE_SECD` (03) / `HOUSE_SECD_NM` | |
| 주택상세구분코드 / 명 | **`HOUSE_DETAIL_SECD`** (03) / `HOUSE_DETAIL_SECD_NM` | ⚠ 다른 유형은 `HOUSE_DTL_SECD` — **언더스코어 위치가 다르다** |
| 주택구분 (검색용) | `SEARCH_HOUSE_SECD` (0303) | |
| 공급지역코드 / 명 | `SUBSCRPT_AREA_CODE` / `SUBSCRPT_AREA_CODE_NM` | |
| 모집공고일 | `RCRIT_PBLANC_DE` | **`YYYYMMDD`** |
| 신문사 | `NSPRC_NM` | |
| 청약접수 시작/종료일 | `SUBSCRPT_RCEPT_BGNDE` / `SUBSCRPT_RCEPT_ENDDE` | |
| 당첨자발표일 | `PRZWNER_PRESNATN_DE` | |
| 공급위치 우편번호 / 주소 | `HSSPLY_ZIP` / `HSSPLY_ADRES` | |
| 공급규모 | `TOT_SUPLY_HSHLDCO` | |
| 계약 시작/종료일 | `CNTRCT_CNCLS_BGNDE` / `CNTRCT_CNCLS_ENDDE` | |
| 홈페이지 / 사업주체 / 문의처 | `HMPG_ADRES` / `BSNS_MBY_NM` / `MDHS_TELNO` | |
| 입주예정월 | `MVN_PREARNGE_YM` | |
| 공고문 URL | `PBLANC_URL` | |

## A-8. `getPblPvtRentLttotPblancMdl`

| 한글 | 필드 |
|---|---|
| 주택관리번호 / 공고번호 / 모델번호 | `HOUSE_MANAGE_NO` / `PBLANC_NO` / `MODEL_NO` |
| 군 / 타입 | `GP` / `TP` |
| **전용면적** / 공급면적 / 계약면적 | `EXCLUSE_AR` / `SUPLY_AR` / `CNTRCT_AR` |
| 공급세대수 | `SUPLY_HSHLDCO` |
| 일반공급 세대수 | `GNSPLY_HSHLDCO` |
| 특별공급 청년 | `SPSPLY_YGMN_HSHLDCO` |
| 특별공급 신혼 | `SPSPLY_NEW_MRRG_HSHLDCO` |
| 특별공급 고령자 | `SPSPLY_AGED_HSHLDCO` |
| 공급금액 (만원) | `SUPLY_AMOUNT` |
| 청약신청금 (만원) | `SUBSCRPT_REQST_AMOUNT` |

**특별공급 축이 APT와 완전히 다르다** (청년 / 신혼 / 고령자).
유일하게 `EXCLUSE_AR`과 `SUPLY_AR`을 둘 다 준다 → 전용면적을 우선 쓴다.

---

## A-9. `getOPTLttotPblancDetail` — 임의공급

| 한글 | 필드 | 비고 |
|---|---|---|
| 주택관리번호 / 공고번호 / 주택명 | `HOUSE_MANAGE_NO` / `PBLANC_NO` / `HOUSE_NM` | |
| 주택구분코드 / 명 | `HOUSE_SECD` / `HOUSE_SECD_NM` | 코드값 설명 스펙에 없음 [미확인] |
| 공급지역코드 / 명 | `SUBSCRPT_AREA_CODE` / `SUBSCRPT_AREA_CODE_NM` | |
| 공급위치 우편번호 / 주소 | `HSSPLY_ZIP` / `HSSPLY_ADRES` | |
| 공급규모 | `TOT_SUPLY_HSHLDCO` | |
| 모집공고일 | `RCRIT_PBLANC_DE` | **`YYYYMMDD`** |
| 청약접수 시작/종료일 | `SUBSCRPT_RCEPT_BGNDE` / `SUBSCRPT_RCEPT_ENDDE` | |
| 특별공급 접수 시작/종료일 | `SPSPLY_RCEPT_BGNDE` / `SPSPLY_RCEPT_ENDDE` | |
| 일반공급 접수 시작/종료일 | `GNRL_RCEPT_BGNDE` / `GNRL_RCEPT_ENDDE` | |
| 당첨자발표일 | `PRZWNER_PRESNATN_DE` | |
| 계약 시작/종료일 | `CNTRCT_CNCLS_BGNDE` / `CNTRCT_CNCLS_ENDDE` | |
| 홈페이지 / 사업주체 / 문의처 / 입주예정월 / URL | `HMPG_ADRES` / `BSNS_MBY_NM` / `MDHS_TELNO` / `MVN_PREARNGE_YM` / `PBLANC_URL` | |

## A-10. `getOPTLttotPblancMdl`

| 한글 | 필드 |
|---|---|
| 주택관리번호 / 공고번호 / 모델번호 | `HOUSE_MANAGE_NO` / `PBLANC_NO` / `MODEL_NO` |
| 주택형 | `HOUSE_TY` |
| 일반공급세대수 | `SUPLY_HSHLDCO` |
| 공급금액 (만원) | `LTTOT_TOP_AMOUNT` |

**면적 필드가 없다** → `SupplyRow.area.value = null`.
특별공급 세부 필드도 없다.

---

# (B) 청약홈 경쟁률·특별공급 — 15098905

base: `https://api.odcloud.kr/api/ApplyhomeInfoCmpetRtSvc/v1`

**(A)와 base URL만 다르고 파라미터 문법·응답 래퍼는 동일하다.**
인증키도 계정 공용이라 같은 값을 쓴다.

## 오퍼레이션별 지원 필터 [확정]

| 오퍼레이션 | `cond` 지원 필드 |
|---|---|
| `getAPTLttotPblancCmpet` | `HOUSE_MANAGE_NO`, `PBLANC_NO`, `RESIDE_SECD` |
| `getUrbtyOfctlLttotPblancCmpet` | `HOUSE_MANAGE_NO`, `PBLANC_NO` |
| `getPblPvtRentLttotPblancCmpet` | `HOUSE_MANAGE_NO`, `PBLANC_NO`, `SPSPLY_KND_CODE` |
| `getCancResplLttotPblancCmpet` | `HOUSE_MANAGE_NO`, `PBLANC_NO` |
| `getRemndrLttotPblancCmpet` | `HOUSE_MANAGE_NO`, `PBLANC_NO`, `REMNDR_HSHLD_PBLANC_TYCD` |
| `getOPTLttotPblancCmpet` | `HOUSE_MANAGE_NO`, `PBLANC_NO` |
| `getAptLttotPblancScore` | `HOUSE_MANAGE_NO`, `PBLANC_NO`, `RESIDE_SECD` |
| `getAPTSpsplyReqstStus` | `HOUSE_MANAGE_NO`, `PBLANC_NO` |

**코드값**

| 파라미터 | 값 |
|---|---|
| `RESIDE_SECD` | `01` 해당지역 / `02` 기타지역 / `03` 기타경기 |
| `SPSPLY_KND_CODE` | `00` 일반 / `SY` 청년 / `SN` 신혼 / `SO` 고령자 |
| `REMNDR_HSHLD_PBLANC_TYCD` | `01` 사후 / `02` 사전 |

---

## B-1. `getAPTLttotPblancCmpet` — APT 경쟁률

| 한글 | 필드 | 타입 |
|---|---|---|
| 주택관리번호 | `HOUSE_MANAGE_NO` | string |
| 공고번호 | `PBLANC_NO` | string |
| **모델번호** | `MODEL_NO` | string — **조인 키 1순위** |
| 주택형 | `HOUSE_TY` | string |
| 공급세대수 | `SUPLY_HSHLDCO` | integer |
| 순위 | `SUBSCRPT_RANK_CODE` | integer (1/2) |
| 거주코드 | `RESIDE_SECD` | string |
| 거주지역명 | `RESIDE_SENM` | string |
| 접수건수 | `REQ_CNT` | **string** |
| 경쟁률 | `CMPET_RATE` | **string** |

`CMPET_RATE`가 `string`인 것은 확정. 청약홈 화면에서 미달 시 `△` 표기가 관측됐으나
**API 필드 값에 그대로 들어가는지는 [미확인]**. → `parseCompetitionRate()`로 숫자 파싱 시도,
실패 시 원문 보존.

실측 화면값(청약홈 경쟁률 팝업): 주택형 `"084.9976A"`, `"084.9892B"`, `"107.9858"`,
경쟁률 `"1.10"`, `"2.00"`, `"3.00"`, 미달 표기 `△524`

## B-2. `getUrbtyOfctlLttotPblancCmpet`

`HOUSE_MANAGE_NO`, `PBLANC_NO`, `MODEL_NO`, `HOUSE_TY`, `SUPLY_HSHLDCO`,
`RESIDNT_PRIOR_AT` (거주자우선여부), `RESIDNT_PRIOR_SENM`, `REQ_CNT`, `CMPET_RATE`

## B-3. `getPblPvtRentLttotPblancCmpet`

위 필드 + `SPSPLY_KND_CODE`, `SPSPLY_KND_NM`, `SPSPLY_KND_HSHLDCO`

## B-4. `getCancResplLttotPblancCmpet` — 취소후재공급

공통: `HOUSE_MANAGE_NO`, `PBLANC_NO`, `MODEL_NO`, `HOUSE_TY`, `SUPLY_HSHLDCO`

**특별공급 유형이 필드명 접두어로 직접 노출된다:**

| 유형 | 배정세대수 | 접수건수 | 경쟁률 |
|---|---|---|---|
| 일반공급 | `NORMAL_HSHLDCO` | `NORMAL_REQ_CNT` | `NORMAL_CMPET_RATE` |
| 다자녀 | `MNYCH_HSHLDCO` | `MNYCH_REQ_CNT` | `MNYCH_CMPET_RATE` |
| 신혼부부 | `NWWDS_HSHLDCO` | `NWWDS_REQ_CNT` | `NWWDS_CMPET_RATE` |
| 생애최초 | `LFE_FRST_HSHLDCO` | `LFE_FRST_REQ_CNT` | `LFE_FRST_CMPET_RATE` |
| 노부모부양 | `OLD_PARNTS_SUPORT_HSHLDCO` | `OLD_PARNTS_SUPORT_REQ_CNT` | `OLD_PARNTS_SUPORT_CMPET_RATE` |
| 기관추천 | `INSTT_RECOMEND_HSHLDCO` | `INSTT_RECOMEND_REQ_CNT` | `INSTT_RECOMEND_CMPET_RATE` |

"이전기관" · "기타" 전용 필드는 이 오퍼레이션에서 **확인되지 않음** [미확인].

## B-5. `getRemndrLttotPblancCmpet` — 잔여세대

`HOUSE_MANAGE_NO`, `PBLANC_NO`, `REMNDR_HSHLD_PBLANC_TYCD`, `HOUSE_TY`,
`SUPLY_HSHLDCO`, `REQ_CNT`, `CMPET_RATE`

**`MODEL_NO`가 없다** → `houseTypeKey` 폴백 조인 대상.

## B-6. `getOPTLttotPblancCmpet` — 임의공급

`HOUSE_MANAGE_NO`, `PBLANC_NO`, `HOUSE_TY`, `SUPLY_HSHLDCO`, `REQ_CNT`, `CMPET_RATE`

**`MODEL_NO`가 없다** → `houseTypeKey` 폴백 조인 대상.

## B-7. `getAptLttotPblancScore` — 당첨가점 (APT 전용)

| 한글 | 필드 |
|---|---|
| 주택관리번호 / 공고번호 / 모델번호 / 주택형 | `HOUSE_MANAGE_NO` / `PBLANC_NO` / `MODEL_NO` / `HOUSE_TY` |
| 거주지역 구분 / 명 | `RESIDE_SECD` / `RESIDE_SENM` |
| **최저 당첨가점** | `LWET_SCORE` |
| **최고 당첨가점** | `TOP_SCORE` |
| **평균 당첨가점** | `AVRG_SCORE` |

가점 계산기 결과와 나란히 보여주는 데 쓴다.

## B-8. `getAPTSpsplyReqstStus` — 특별공급 신청현황 (APT 전용)

2024.12.03 문서 개정판에서 추가된 오퍼레이션이다.
**거주지역 × 특별공급유형 2차원** 구조다.

**배정세대수**

| 유형 | 필드 |
|---|---|
| 다자녀 | `MNYCH_HSHLDCO` |
| 신혼부부 | `NWWDS_NMTW_HSHLDCO` |
| 생애최초 | `LFE_FRST_HSHLDCO` |
| 청년 | `YGMN_HSHLDCO` |
| 노부모부양 | `OLD_PARNTS_SUPORT_HSHLDCO` |
| 신생아 | `NWBB_NWBBSHR_HSHLDCO` |
| 기관추천 | `INSTT_RECOMEND_HSHLDCO` |
| 이전기관 | `TRANSR_INSTT_ENFSN_HSHLDCO` |

**접수건수** — 거주지역 접두어 + 유형코드 + `_CNT`

| 접두어 | 의미 |
|---|---|
| `CRSPAREA_` | 해당지역 |
| `CTPRVN_` | 기타경기 |
| `ETC_AREA_` | 기타지역 |

유형코드: `MNYCH`, `NWWDS_NMTW`, `LFE_FRST`, `YGMN`, `OPS`, `NWBB_NWBBSHR`

예: `CRSPAREA_MNYCH_CNT` = 해당지역 다자녀 접수건수

**예외**

| 유형 | 필드 |
|---|---|
| 기관추천 | `INSTT_RECOMEND_DCSN_CNT` (당첨결정) / `INSTT_RECOMEND_PREPAR_CNT` (예비자) |
| 이전기관 | `TRANSR_INSTT_ENFSN_CNT` |

기타: `SUBSCRPT_RESULT_NM` (청약결과), `HOUSE_TY`, `SPSPLY_HSHLDCO`

"기타" 유형 전용 필드는 **확인되지 않음** [미확인].

> OAS 조회가 대형 JSON 요약 처리를 거쳤으므로, 필드 존재와 명명 규칙은 신뢰도가 높지만
> 개별 타입(integer/string)과 필드 목록 완전성은 100% 보증되지 않는다 → Phase 8에서 확인.

---

# (C) R-ONE 부동산통계

## 엔드포인트 [확정 — 실제 호출]

```
https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do
```

`SttsApiTbl.do`(Data 없는 버전)도 같은 응답을 반환하나, 정식 예시는 `SttsApiTblData.do`다.
과거 `www.r-one.co.kr` 주소는 폐기됐다.

| 용도 | URL |
|---|---|
| 개발가이드 | `/r-one/portal/openapi/openApiDevPage.do` |
| Open API 소개 | `/r-one/portal/openapi/openApiIntroPage.do` |
| **인증키 발급** (로그인 필요) | `/r-one/portal/openapi/openApiActKeyPage.do` |
| **통계코드 검색** (JS 동적, 자동조회 불가) | `/r-one/portal/openapi/openApiGuideCdPage.do` |

문의: 053-663-8567

## 요청 파라미터 [확정 — 대부분 실측]

| 파라미터 | 설명 | 상태 |
|---|---|---|
| `KEY` | 인증키 | [확정] 생략 시 샘플모드 |
| `Type` | `xml` \| `json`, **기본값 `xml`** | [확정] 반드시 `json` 명시 |
| `pIndex` | 페이지 번호 | [확정] 샘플모드에서 무시됨 |
| `pSize` | 페이지당 건수 | [확정] 샘플모드에서 무시됨 |
| `STATBL_ID` | 통계표 ID (대문자 그대로) | [확정] |
| `DTACYCLE_CD` | 수록주기 — `MM` 월 / `YY` 연 | `MM` [확정], 분기 `QY` [미확인] |
| `CLS_ID` | 지역·분류 ID | [확정] `500001` = 전국 |
| `ITM_ID` | 항목 ID | [확정] `100001` = 지수 |
| `START_WRTTIME` / `END_WRTTIME` | 기간 범위 | **[미확인]** 문서상 존재, 실호출 안 함. 형식 `YYYYMM` 추정 |
| `WRTTIME_IDTFR_ID` | 특정 시점 필터 | [확정] `"202501"` 형식으로 동작 |

> ⚠ `KEY=sample` 처럼 문자열 `"sample"`을 실제로 넣으면 `ERROR-290` 에러가 난다.
> 개발가이드의 "기본값 sample" 표현에 낚이지 말 것. 샘플모드는 **파라미터 자체를 생략**할 때다.

## 통계표 코드 (`STATBL_ID`)

| 통계 | 코드 | 상태 |
|---|---|---|
| 아파트 **매매**가격지수 (월) | `A_2024_00045` | **[확정]** 실호출 성공 |
| 아파트 **전세**가격지수 (월) | `A_2024_00050` | **[확정]** 실호출 성공 |
| 공동주택 **실거래가격지수** (월) | — | **[미확인]** |

실거래가격지수 코드는 GitHub·블로그·검색 어디서도 찾지 못했다.
reb.or.kr 콘텐츠 페이지의 `S231520283`은 R-ONE `STATBL_ID` 포맷과 달라 통계승인번호 계열로 추정된다.
→ **통계코드 검색 화면에서 "실거래가격지수"로 직접 검색해 확보한다.**

`STATBL_ID` 포맷은 두 종류가 혼재한다:

- `A_2024_NNNNN` — 구코드 재정비형
- `T` + 15자리 숫자 — 신규 등록형 (예: `T244183132827305` = 주간 매매가격지수)

검색 시 두 포맷 다 나올 수 있다.

## 응답 구조 [확정 — 실제 응답 원문]

```json
{
  "SttsApiTblData": [
    { "head": [
        { "list_total_count": 56148 },
        { "RESULT": { "CODE": "INFO-000", "MESSAGE": "정상 처리되었습니다." } }
    ] },
    { "row": [
      {
        "STATBL_ID": "A_2024_00045",
        "DTACYCLE_CD": "MM",
        "WRTTIME_IDTFR_ID": "202501",
        "GRP_ID": null, "GRP_NM": null, "GRP_FULLNM": null,
        "CLS_ID": 500001, "CLS_NM": "전국", "CLS_FULLNM": "전국",
        "ITM_ID": 100001, "ITM_NM": "지수", "ITM_FULLNM": "지수",
        "DTA_VAL": 97.2393481656035,
        "UI_NM": "지수",
        "WRTTIME_DESC": "2025년 1월"
      }
    ] }
  ]
}
```

- 최상위 래퍼 `SttsApiTblData`는 **배열**이고 `[0]`=head 객체, `[1]`=row 배열이다.
- **에러 시엔 래퍼 없이 `{"RESULT":{"CODE":"...","MESSAGE":"..."}}` 단독으로 온다.**
  → 파서가 두 형태를 모두 처리해야 한다.

### row 필드 [확정]

| 필드 | 의미 |
|---|---|
| `STATBL_ID` | 통계표 ID |
| `DTACYCLE_CD` | 수록주기 |
| `WRTTIME_IDTFR_ID` | **시점** (`YYYYMM`) |
| `GRP_ID` / `GRP_NM` / `GRP_FULLNM` | 그룹 (보통 `null`) |
| `CLS_ID` / `CLS_NM` / `CLS_FULLNM` | **분류·지역** |
| `ITM_ID` / `ITM_NM` / `ITM_FULLNM` | 항목 |
| `DTA_VAL` | **값** (number) |
| `UI_NM` | 단위 |
| `WRTTIME_DESC` | 시점 설명 ("2025년 1월") |

### `RESULT.CODE`

| 코드 | 의미 | 상태 |
|---|---|---|
| `INFO-000` | 정상 | [확정] |
| `ERROR-290` | 인증키가 유효하지 않습니다 | [확정] |
| 전체 코드표 | — | **[미확인]** 개발가이드에 없음 |

## 샘플모드 동작 [확정 — 실측]

`KEY` 파라미터를 **생략**하면:

- 에러가 아니라 `INFO-000` 정상 응답
- **가짜 샘플이 아니라 실제 데이터**의 앞부분
- **5건 고정** (`pSize=300`을 줘도 5건)

> 개발가이드 문서는 "10건"이라고 기술하고 있으나 실측은 **5건**이었다. 문서-실측 불일치.

**"`Type=json`인데 에러가 xml로 온다"는 이슈는 이번 조사에서 재현되지 않았다** [미확인].
정상·오류 응답 모두 JSON으로 왔다. xml 폴백은 방어 코드로만 유지한다.

## 지역 표기 (`CLS_NM` / `CLS_FULLNM`) [확정 — 부분]

`"서울특별시"` 같은 정식 행정명이 아니라 **축약형**이다 — (A)의 17개 표기와 형식이 일치한다.

실측 확인된 축약형: `서울`, `경기`, `부산`, `충남`, `전북`, `울산`

**지역 계층이 다단계 트리다:**

```
전국                              (CLS_ID=500001, 단독 행 — 확정)
경기>경부1권>안양시>만안구
서울>강북지역
부산>중부산권
```

| 항목 | 상태 |
|---|---|
| `전국` 집계행 (`CLS_ID=500001`) | [확정] |
| 시도 단독 집계행(`>` 없는 `서울` 등)의 `CLS_ID` | **[미확인]** — 샘플 5건 범위에서 `전국`만 확인 |
| 세종 / 강원 / 제주 축약형 표기 | **[미확인]** |
| 전남광주통합특별시 반영 여부 | **[미확인]** — 재확인 필요 |

> R-ONE 공지에 "2026년 7월 전남광주통합특별시 출범에 따른 지수 기준시점 변경"이 있었다.
> 매핑 테이블을 채울 때 현행 지역 표기를 반드시 확인한다.

---

# Phase 8 확인 체크리스트

키를 받은 뒤 `curl`로 확인할 항목. 위에서 **[미확인]**으로 표기된 것들이다.

## (A) 분양정보

- [ ] `getUrbtyOfctlLttotPblancDetail` / `Mdl` 실제 payload — 값이 채워진 응답
- [ ] `getPblPvtRentLttotPblancDetail` / `Mdl` 실제 payload
- [ ] `getOPTLttotPblancDetail` / `Mdl` 실제 payload
- [ ] `HOUSE_DETAIL_SECD` vs `HOUSE_DTL_SECD` — 공공지원 민간임대의 실제 키
- [ ] `getOPTLttotPblancDetail`의 `HOUSE_SECD` 코드값 의미
- [ ] `SUBSCRPT_AREA_CODE` 숫자 코드 17개 (지역 필터를 상류로 넘길지 재검토)
- [ ] 금액 필드에 실제로 쉼표가 들어오는 케이스가 있는지
- [ ] `PBL_PVT_RENT` / `OPT`의 `cond[RCRIT_PBLANC_DE::GTE]`가 `YYYYMMDD`로 동작하는지

## (B) 경쟁률

- [ ] 8개 오퍼레이션 실제 raw JSON
- [ ] `CMPET_RATE`에 `△` 등 비수치 값이 실제로 들어오는지
- [ ] **`HOUSE_TY`가 (A) Mdl과 바이트 단위로 일치하는지** — 같은 `HOUSE_MANAGE_NO`+`PBLANC_NO`로 양쪽 호출해 비교. 조인 키 선택의 근거
- [ ] `perPage` 최대값
- [ ] `getCancResplLttotPblancCmpet`의 이전기관·기타 필드 존재 여부
- [ ] `getAPTSpsplyReqstStus`의 "기타" 유형 필드
- [ ] 필드 타입 (integer / string) 실제 확인

## (C) 부동산통계

- [ ] **공동주택 실거래가격지수 `STATBL_ID`** ← 통계코드 검색
- [ ] **시도별 `CLS_ID` 17개** ← 통계코드 검색 또는 필터 없이 조회
- [ ] 세종 / 강원 / 제주 축약형 실제 표기
- [ ] 전남광주통합특별시 반영 여부
- [ ] `START_WRTTIME` / `END_WRTTIME` 실제 동작 + 값 형식
- [ ] 정상 키로 호출 시 건수가 5건을 넘는지 (sample 감지 임계값 검증)
- [ ] `RESULT.CODE` 전체 목록
