# applyhome 픽스처

Phase 8에서 `ODCLOUD_SERVICE_KEY`로 전 오퍼레이션 실응답을 확보해 이 10개를 전부 실제 캡처로
교체했다(2026-09-24). Phase 1~7까지는 인증키가 없어 스키마 기반 합성으로 대체했었다.

## 신뢰도

| 파일 | 상태 |
|---|---|
| `apt-detail.json` / `apt-mdl.json` | **실측 캡처** — `2026820011`(시흥하중지구 A-4블록), Phase 1~7과 같은 공고. `HOUSE_TY`가 `055.0000O`/`056.0000O`(정수+소수점+영문, `㎡` 표기 아님), `SUPLY_AR`이 문자열(`"84.0121"`) |
| `remndr-detail.json` / `remndr-mdl.json` | **실측 캡처** — `2026930040`(강변역 센트럴 아이파크), `HOUSE_SECD=06`(취소후재공급). Mdl이 1건뿐이다(무순위 재공급 특성상 세대수가 작다) |
| `urbty-detail.json` / `urbty-mdl.json` | **실측 캡처** — `2026950083`(숭의역 노르웨이숲 더 스카이). Mdl의 `GP`가 두 행 모두 `"-"`(값 없음 자리표시자, Phase 8 버그 회귀 케이스) |
| `rent-detail.json` / `rent-mdl.json` | **실측 캡처** — `2026850049`(부경경마공원역 대방 디에트르 더리버). Mdl의 `GP`가 두 행 모두 `"-"`, `TP`가 `59A-1`/`59B-1`(숫자로 끝나는 접미사 — Phase 8 조인 충돌 회귀 케이스) |
| `opt-detail.json` / `opt-mdl.json` | **실측 캡처** — `2026940212`(리아츠 더 인천). `HOUSE_TY` 중 하나(`"074.9976 "`, `MODEL_NO=03`)가 말미 공백을 달고 온다 — 조인 키 트리밍 검증용 |

## Phase 1~7 대비 바뀐 노티스 ID

REMNDR/URBTY_OFCTL/PBL_PVT_RENT/OPT 4개 유형은 이전 스키마 기반 합성 픽스처가 가리키던 ID와
다르다. 실측 캡처에서 Detail·Mdl이 같은 공고로 매칭되는 것을 그대로 썼기 때문이다(APT만 우연히
같은 공고 `2026820011`이 다시 잡혔다). `test/fixtures/competition/`의 대응 파일도 같이 옮겼다 —
그 README 참조.

## Phase 8이 드러낸 것 — 실측으로 확정, 정정된 것

- **`㎡` 표기는 API에 존재하지 않는다.** `apt-mdl.json`의 옛 `55㎡O`는 청약홈 **웹사이트 렌더링**을
  API 실측으로 잘못 기록한 것이었다. 실제 값은 `055.0000O`.
- **`GP`(군)가 없으면 빈 문자열이 아니라 `"-"`로 온다**(`urbty-mdl.json`·`rent-mdl.json` 전 행).
  `lib/applyhome/adapters/{urbty,rent}.ts`가 `isMeaningfulValue`로 걸러낸다.
- **`TP`가 숫자로 끝나는 접미사를 쓴다**(`59A-1`, `84A1` 등). 조인 키(`houseTypeKey`)는 이제
  원문을 트리밍만 해서 쓴다 — `lib/applyhome/parse.ts`의 `toHouseTypeKey` 참조.
- **`CMPET_RATE`의 미달 표기는 괄호가 붙는다**(`"(△9)"`) — `apt-cmpet.json` 참조.

## 의도적으로 넣은 케이스 (여전히 유효)

- `apt-detail.json`: `GNRL_RNK1_ETC_GG_*`/`GNRL_RNK2_ETC_GG_*`가 `null`(실측 그대로) — 접수 윈도우가
  8개 중 6개만 온다.
- `remndr-detail.json`: `all`(`SUBSCRPT_RCEPT_BGNDE/ENDDE`)과 `general`(`GNRL_RCEPT_BGNDE/ENDDE`)의
  날짜가 실측으로 완전히 같다 — §9가 문서화한 "REMNDR: all + general 날짜 동일 케이스"를 실제
  데이터로 재현한다.
- `opt-detail.json`: `GNRL_RCEPT_BGNDE`/`ENDDE`가 `null` — `all` 윈도우 하나만 남는다.

## GP/TP 조합 (urbty, rent)

`URBTY_OFCTL`·`PBL_PVT_RENT` Mdl은 `HOUSE_TY` 단일 필드가 아니라 `GP`(군) + `TP`(타입) 조합이다.
Phase 8 실측으로 `GP`가 전부(또는 대부분) `"-"`로 온다는 것과 `TP`가 `84OB`/`59A-1`/`084.9976`
등 다양한 표기를 쓴다는 것이 확인됐다.
