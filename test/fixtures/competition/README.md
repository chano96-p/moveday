# competition 픽스처

인증키가 없어 (B) 경쟁률·특별공급·당첨가점 API를 실호출로 확인할 수 없었다.
GitHub 등 공개 저장소에도 실측 캡처가 없었다. **전부 OAS 스키마 기반 합성 —
Phase 8에서 실제 응답으로 교체한다.**

| 파일 | 대응 오퍼레이션 | 대응 공고 |
|---|---|---|
| `apt-cmpet.json` | `getAPTLttotPblancCmpet` | `2026820011` (APT) |
| `apt-score.json` | `getAptLttotPblancScore` | `2026820011` (APT) |
| `apt-special-supply.json` | `getAPTSpsplyReqstStus` | `2026820011` (APT) |
| `urbty-cmpet.json` | `getUrbtyOfctlLttotPblancCmpet` | `2026410099` (URBTY_OFCTL) |
| `remndr-cmpet.json` | `getRemndrLttotPblancCmpet` | `2026999002` (REMNDR, `HOUSE_SECD=04`, dev 추가 공고) |
| `canc-respl-cmpet.json` | `getCancResplLttotPblancCmpet` | `2026930035` (REMNDR, `HOUSE_SECD=06`) |
| `opt-cmpet.json` | `getOPTLttotPblancCmpet` | `2026700012` (OPT) |

`getPblPvtRentLttotPblancCmpet`(`PBL_PVT_RENT`, `2026500077`)는 **의도적으로 픽스처가 없다** —
`/api/notices/{id}/competition`이 204를 내는 경로를 재현하기 위한 것이다.

## 폴백 조인 검증

- `urbty-cmpet.json`·`apt-cmpet.json`·`canc-respl-cmpet.json`은 `MODEL_NO`가 있다 → 모델 조인.
- `remndr-cmpet.json`·`opt-cmpet.json`은 `MODEL_NO`가 **없다**(B-5/B-6 확정) → `houseTypeKey` 폴백 조인.
  `opt-cmpet.json`의 `"59㎡A"`는 Mdl 쪽 `"059.9500A"`와 표기가 달라도 같은 키로 묶이는지까지 검증한다.
- `remndr-cmpet.json`이 가리키는 `2026999002`는 원래 Mdl 픽스처가 없어(Phase 2 dev 추가 공고,
  상태 재현용) 주택형 목록 자체가 비어 있었다. 폴백 조인을 화면에서 확인할 수 있게
  `test/fixtures/dev/remndr-mdl-extra.json`을 추가했다.

## 그 외

- `apt-cmpet.json`의 두 번째 모델(`02`)은 `CMPET_RATE: "△524"` — 미달 표기 비수치 값 케이스다.
- `canc-respl-cmpet.json`은 유형별 접두어 열이 한 행에 나란히 오는 B-4 특유의 "넓은" 구조다.
- 기존 `test/fixtures/applyhome/` 10개, `test/fixtures/dev/`의 기존 2개(`apt-detail-extra.json`,
  `remndr-detail-extra.json`)는 **수정하지 않았다.**
