# applyhome 픽스처

Phase 1은 인증키가 없어 실제 API 응답을 받을 수 없다. 아래 픽스처로 정규화 계층과
단위 테스트를 완성하고, Phase 8(키 수령 후)에서 실제 응답으로 교체한다.

## 신뢰도

| 파일 | 상태 |
|---|---|
| `apt-detail.json` | **실측 캡처 원문** — API-FIELDS.md A-1, 2026-09-22 라이브 캡처 그대로 |
| `apt-mdl.json` | 부분 실측 — `HOUSE_TY`(`55㎡O`/`56㎡O`), `LTTOT_TOP_AMOUNT`(`36707`/`39358`)는 A-2 실측값. 나머지 필드(세대수 배분, 특별공급 세부)는 **스키마 기반 합성**. 두 번째 행의 `LTTOT_TOP_AMOUNT`는 쉼표 포함(`"39,358"`)으로 의도적으로 변형해 파서 테스트용으로 씀 |
| `remndr-detail.json` / `remndr-mdl.json` | 부분 실측 — `HOUSE_NM`, `HOUSE_SECD_NM`, `HSSPLY_ADRES`, `RCRIT_PBLANC_DE`, `PBLANC_URL`, `HOUSE_TY`(`84㎡A`/`99㎡A`), `LTTOT_TOP_AMOUNT`(`35550`/`37708`)는 A-6 실측 관측값. 나머지는 **스키마 기반 합성 — Phase 8에서 실제 응답으로 교체** |
| `urbty-detail.json` / `urbty-mdl.json` | **스키마 기반 합성 — Phase 8에서 실제 응답으로 교체**. 실측 샘플 없음 |
| `rent-detail.json` / `rent-mdl.json` | **스키마 기반 합성 — Phase 8에서 실제 응답으로 교체**. 실측 샘플 없음 |
| `opt-detail.json` / `opt-mdl.json` | **스키마 기반 합성 — Phase 8에서 실제 응답으로 교체**. 실측 샘플 없음 |

## 의도적으로 넣은 케이스

- `apt-detail.json`: `SPSPLY_RCEPT_BGNDE`/`ENDDE`가 `null` (실측 그대로). 접수 윈도우가 8개 중
  일부만 온다는 것을 보여준다. `GNRL_RNK1_ETC_GG_*`, `GNRL_RNK2_ETC_GG_*`,
  `GNRL_RNK2_ETC_AREA_*`도 `null`.
- `remndr-detail.json` / `opt-detail.json`: `SPSPLY_RCEPT_BGNDE`/`ENDDE`를 `null`로 둬서
  3개 윈도우 중 2개만 존재하는 케이스를 포함.
- `rent-detail.json` / `opt-detail.json`: 날짜가 전부 `YYYYMMDD` (설계 §4.3① 반영,
  공공지원 민간임대도 임의공급과 동일하게 압축 형식).
- `apt-mdl.json` / `urbty-mdl.json`: 금액에 쉼표가 섞인 값을 하나씩 포함해 `parseAmount` 검증.

## GP/TP 조합 (urbty, rent)

`URBTY_OFCTL`·`PBL_PVT_RENT` Mdl은 `HOUSE_TY` 단일 필드가 아니라 `GP`(군) + `TP`(타입) 조합이다.
실측 샘플이 없어 `TP`를 `HOUSE_TY`와 같은 표기 형식(`"059.9800A"`)으로 가정해 합성했다.
이 가정은 Phase 8에서 실제 응답으로 검증해야 한다.
