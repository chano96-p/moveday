# competition 픽스처

Phase 8에서 실응답을 확보했지만, 경쟁률·특별공급·당첨가점 오퍼레이션은 조회 조건이 Detail/Mdl과
달라서 캡처된 실측 표본이 같은 공고를 가리키지 않았다(예: `getAPTLttotPblancCmpet` 실측 표본은
`2026820011`이 아니라 다른 공고였다). 추가 API 호출 없이 작업해야 해서, **여기 7개는 여전히
합성이다** — 다만 Phase 8 실측으로 확정된 필드명·값 형식(괄호 붙은 `△` 표기, 실제 `HOUSE_TY`
표기, CancRespl 6개 접두어 전체)을 반영해 정확도를 올렸고, `test/fixtures/applyhome/`이 바뀐
노티스 ID·`MODEL_NO`·`HOUSE_TY`에 맞춰 다시 연결했다.

| 파일 | 대응 오퍼레이션 | 대응 공고 |
|---|---|---|
| `apt-cmpet.json` | `getAPTLttotPblancCmpet` | `2026820011` (APT) — `HOUSE_TY`를 실측 Mdl과 같은 `055.0000O`/`056.0000O`로, 미달 표기를 실측 형식 `"(△9)"`로 갱신 |
| `apt-score.json` | `getAptLttotPblancScore` | `2026820011` (APT) — `HOUSE_TY` 동기화 |
| `apt-special-supply.json` | `getAPTSpsplyReqstStus` | `2026820011` (APT) — `HOUSE_TY`를 실측 형식(`전체` → `055.0000O`)으로 정정. 필드명 집합은 Phase 8 실측과 이미 일치했다 |
| `urbty-cmpet.json` | `getUrbtyOfctlLttotPblancCmpet` | `2026950083` (URBTY_OFCTL) — 새 ID, `HOUSE_TY`를 실측 Mdl의 `TP`(`84OA`/`84OB`)와 동일하게 맞춤 |
| `remndr-cmpet.json` | `getRemndrLttotPblancCmpet` | `2026999002` (REMNDR, `HOUSE_SECD=04`, **dev 추가 공고**) — `HOUSE_TY`를 실측 형식(`059.9800A`)으로 정정 |
| `canc-respl-cmpet.json` | `getCancResplLttotPblancCmpet` | `2026930040` (REMNDR, `HOUSE_SECD=06`) — 새 ID. 6개 접두어(`NORMAL`/`MNYCH`/`NWWDS`/`LFE_FRST`/`OLD_PARNTS_SUPORT`/`INSTT_RECOMEND`) 전부를 필드로 포함해 `toCancResplRows`가 6종을 다 처리하는지 이제 실제로 확인된다 — 이전엔 2개(`NORMAL`/`MNYCH`)만 있었다 |
| `opt-cmpet.json` | `getOPTLttotPblancCmpet` | `2026940212` (OPT) — 새 ID, `HOUSE_TY`를 실측 Mdl의 `HOUSE_TY`(`059.9892B`/`084.9718B`)와 동일하게 맞춤 |

`getPblPvtRentLttotPblancCmpet`(`PBL_PVT_RENT`, `2026850049`)는 **의도적으로 픽스처가 없다** —
`/api/notices/{id}/competition`이 204를 내는 경로를 재현하기 위한 것이다. Phase 8 실측에서 이
오퍼레이션 자체는 다른 공고에 대해 데이터를 반환하는 것을 확인했지만(204는 이 특정 공고에만
해당), 이 픽스처의 의도는 그대로 유지한다.

## `remndr-cmpet.json`은 dev 픽스처와 짝을 이룬다

`remndr-cmpet.json`은 `test/fixtures/dev/remndr-mdl-extra.json`(`houseTypeKey` 폴백 조인 재현용
dev 공고)과 `HOUSE_TY`가 원문 그대로 일치해야 한다 — Phase 8부터 조인 키(`toHouseTypeKey`)가
정규화 없이 원문을 그대로 쓰기 때문이다(§4.0). `㎡`는 API에 존재하지 않는 표기라 두 파일 모두
실측 형식(`059.9800A`)으로 맞췄다.

## 폴백 조인 검증

- `urbty-cmpet.json`·`apt-cmpet.json`·`canc-respl-cmpet.json`은 `MODEL_NO`가 있다 → 모델 조인.
- `remndr-cmpet.json`·`opt-cmpet.json`은 `MODEL_NO`가 **없다**(B-5/B-6 확정, Phase 8 실측으로도
  재확인) → `houseTypeKey`(원문 트리밍) 폴백 조인. `opt-cmpet.json`의 `HOUSE_TY`가 Mdl의
  `HOUSE_TY`와 정확히 같은 문자열이어야 조인된다 — Phase 8부터는 정규화가 형식 차이를
  흡수해주지 않는다.

## 그 외

- `apt-cmpet.json`의 두 번째 모델(`02`)은 `CMPET_RATE: "(△9)"` — 미달 표기 실측 형식(괄호 포함).
- `canc-respl-cmpet.json`은 유형별 접두어 열이 한 행에 나란히 오는 B-4 특유의 "넓은" 구조다.
- `test/fixtures/dev/`의 3개는 **Phase 8 교체 대상이 아니다** — 자세한 사유는
  `test/fixtures/dev/README.md` 참조.
