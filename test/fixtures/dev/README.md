# dev 픽스처 — Phase 8 교체 대상이 아니다

`test/fixtures/applyhome/`·`test/fixtures/competition/`·`test/fixtures/rebstat/`의 19개 픽스처는
전부 실제 API 응답이 오면 교체한다. **이 3개는 다르다** — 실제 API에는 존재하지 않는 개발용
공고를 만들어서, 화면에서 재현하기 어려운 상태를 강제로 만들어내기 위한 것이다. 실제 응답으로
바꾸면 그 상태 자체를 잃는다.

| 파일 | 재현하는 상태 |
|---|---|
| `apt-detail-extra.json` (`2026999001`) | **접수기간 미정**(`unknown` status) — `SPSPLY_RCEPT_BGNDE`/`ENDDE`가 전부 없어 D-day를 계산할 기준이 없는 공고 |
| `remndr-detail-extra.json` (`2026999002`) | **접수중**(`open` status)인 무순위 공고 — 대시보드 필터·타임라인이 진행 중 상태를 올바르게 그리는지 확인용 |
| `remndr-mdl-extra.json` (`2026999002`의 Mdl) | `MODEL_NO`가 없어 `houseTypeKey` **폴백 조인**이 실제로 동작하는지 보여주기 위해 붙인 주택형 목록(경쟁률 픽스처 `remndr-cmpet.json`이 이 공고를 가리킨다) |

Phase 8에서 실제 API로 픽스처를 교체할 때 **이 3개는 건너뛴다.** 대신 실제 응답에서 같은 상태
(미정 일정, 접수중, 모델번호 없는 경쟁률)를 관측하면 그때 새로 판단한다.
