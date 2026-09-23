# rebstat 픽스처

인증키가 없어 R-ONE을 실호출로 확인할 수 없었다. **스키마 기반 합성 — Phase 8에서 실제
응답으로 교체한다.** 응답 봉투(`SttsApiTblData` 배열, `head`/`row`)는 API-FIELDS.md (C)에
기록된 실제 응답 원문 구조를 그대로 따랐고, `CLS_ID`/`ITM_ID`/`WRTTIME_DESC` 등 실측 확인된
필드도 그대로 썼다. `DTA_VAL`(지수값)만 합성이다.

| 파일 | `STATBL_ID` | 지역 |
|---|---|---|
| `sale-index.json` | `A_2024_00045`(아파트 매매가격지수) | 전국(`CLS_ID=500001`) |
| `jeonse-index.json` | `A_2024_00050`(아파트 전세가격지수) | 전국(`CLS_ID=500001`) |

- 40개월(2023-06 ~ 2026-09) 연속 데이터 — MarketStrip(24개월)·RegionMarket(36개월) 둘 다
  픽스처만으로 채울 수 있다.
- 값은 소폭 우상향 추세로 합성해 mom/yoy가 항상 0이 아닌 값을 갖게 했다.
- `전국`만 있다 — `REBSTAT_REGION_CLS_ID`에 `전국` 외 16개 지역이 전부 `null`이라(§4.5④,
  Phase 8에서 확보) 그 지역들은 라우트가 픽스처 클라이언트에 도달하기 전에
  `REBSTAT_REGION_UNMAPPED`로 끝난다. 픽스처가 필요 없다.
- 공동주택 실거래가격지수(`apartmentRealTransactionIndex`)는 `STATBL_ID`가 미확정이라
  픽스처가 없다 — `/api/market/real-transaction`은 픽스처 모드에서도 `REBSTAT_TABLE_UNKNOWN`
  503을 낸다. 그게 정상 동작이다(§4.5③).

## 날짜 시프트를 안 하는 이유

`test/fixtures/applyhome`(공고)과 달리 이 픽스처는 **날짜를 오늘 기준으로 밀지 않는다.**
지수 시계열은 "오늘"을 반드시 포함할 필요가 없다 — 과거 몇 년치 흐름만 보여주면 된다.
고정된 40개월(~2026-09)이 계속 최신 구간에 걸치는 한 유효하다.
