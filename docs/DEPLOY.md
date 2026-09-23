# moveday 배포 체크리스트 (Vercel)

## 환경변수

| 이름 | 서버/클라이언트 | 없을 때 동작 | 값 변경 시 재배포 필요? |
|---|---|---|---|
| `ODCLOUD_SERVICE_KEY` | 서버 | `/api/notices`·`/api/notices/{id}`·`/api/notices/{id}/competition`이 503(**상세 화면이 통째로 안 뜬다**). 나머지 정상 | **필요** |
| `REB_STAT_API_KEY` | 서버 | MarketStrip·RegionMarket 섹션만 사라짐(503). 나머지 정상 | **필요** |
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | 클라이언트 | KakaoMap 섹션 자체를 렌더하지 않음 | **필요** |
| `MOVEDAY_USE_FIXTURES` | 서버(개발용) | (프로덕션에는 설정하지 않음 — 아래 참조) | 불필요 |

**세 키 모두 재배포가 필요하지만 이유가 다르다:**

| 키 | 재배포가 필요한 이유 |
|---|---|
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | Next.js가 `NEXT_PUBLIC_*`를 **빌드 시점에 클라이언트 번들에 인라인**한다 — 재빌드 없이는 어떤 방법으로도 못 바꾼다 |
| `ODCLOUD_SERVICE_KEY` | 코드는 런타임에 읽지만, **Vercel의 환경변수는 이미 배포된 함수에는 반영되지 않고 배포 단위에 바인딩**된다 — 프로젝트 설정에서 값만 바꿔도 재배포하지 않으면 그대로다(재빌드 산출물 자체는 바꿀 필요 없이 재배포만 하면 된다) |
| `REB_STAT_API_KEY` | 위와 동일 |

값을 바꾸고 재배포하지 않으면 서버 키도 지도 키만큼이나 계속 이전 상태로 동작한다 — "재배포 없이 적용되는 건 없다"고 보는 게 안전하다.

### `MOVEDAY_USE_FIXTURES`는 프로덕션에 절대 설정하지 않는다

이 값이 설정돼 있으면 실제 API를 호출하지 않고 `test/fixtures/`의 개발용 데이터를 그대로 서비스한다.
Vercel 프로젝트 설정에 이 변수를 넣지 않는다 — Preview/Production 어느 환경에도 넣지 않는다.
배포 후 `/api/health`의 `fixtures` 값이 `false`인지로 확인한다(아래 "배포 후 확인" 참조).

## 카카오 JS 키 도메인 제한

`NEXT_PUBLIC_KAKAO_MAP_KEY`는 클라이언트 번들에 그대로 노출되는 값이라(정상적인 설계다),
**카카오 개발자 콘솔에서 이 키가 동작할 도메인을 반드시 제한해야 한다.** 제한을 걸지 않으면
누구나 이 키를 복사해 자신의 사이트에서 쿼터를 소진시킬 수 있다.

1. [Kakao Developers](https://developers.kakao.com) → 내 애플리케이션 → 해당 앱 선택
2. **앱 설정 → 플랫폼 → Web** 플랫폼 등록
3. 배포 도메인을 사이트 도메인에 추가한다(예: `https://moveday.vercel.app`, Vercel Preview를 쓴다면
   프리뷰 도메인 패턴도 함께 등록해야 한다)
4. 로컬 개발용으로 `http://localhost:3000`도 등록해둔다

## `packageManager: pnpm@11.5.0` 고정 이유

`pnpm-workspace.yaml`의 `allowBuilds`는 **pnpm 11 계열에서 도입된 필드**다(Phase 1 확인).
`packageManager` 필드로 pnpm 버전을 고정하지 않으면 Vercel 빌드 환경이 더 낮은 pnpm 버전을
선택할 수 있고, 그 경우 `allowBuilds`가 조용히 무시돼 승인한 빌드 스크립트가 실행되지 않는다.
버전을 낮추거나 지우지 않는다.

## 배포 전 확인

- [ ] `pnpm vitest run` 전체 통과
- [ ] `pnpm lint` 클린
- [ ] `rm -rf .next && pnpm build` 성공, First Load JS 확인
- [ ] `pnpm build && pnpm start`로 프로덕션 모드 로컬 확인(아래 "프로덕션 모드 확인" 참조)
- [ ] Vercel 프로젝트 설정에 `ODCLOUD_SERVICE_KEY`·`REB_STAT_API_KEY`·`NEXT_PUBLIC_KAKAO_MAP_KEY` 등록,
      **`MOVEDAY_USE_FIXTURES`는 등록하지 않음**
- [ ] 카카오 콘솔에 배포 도메인 등록(위 참조)

## 프로덕션 모드 확인 (로컬)

**로컬 `pnpm start`는 Vercel과 재배포 조건이 다르다.** 서버 키(`ODCLOUD_SERVICE_KEY`·`REB_STAT_API_KEY`)는
로컬에서는 정말로 매 요청마다 런타임에 읽으므로, 서버를 재시작만 해도 바뀐 값이 바로 적용된다(재빌드도
필요 없다). 반면 Vercel은 위 표대로 **재배포가 있어야** 반영된다. 로컬에서 "재시작만 하면 되네"라고
확인한 동작을 배포에 그대로 기대하지 않는다 — `NEXT_PUBLIC_KAKAO_MAP_KEY`는 로컬에서도 재빌드가 필요하다
(빌드 시점 인라인이라 로컬·Vercel 구분이 없다).

`MOVEDAY_USE_FIXTURES`를 설정하지 않고 `pnpm build && pnpm start`로 띄운 뒤:

- `curl http://localhost:3000/api/notices` → 키가 없으면 **503**이어야 한다(픽스처가 새면 200 + 가짜 데이터가 나온다)
- `curl http://localhost:3000/api/health` → `keys.odcloud`·`keys.rebstat`·`keys.kakaoMap`이 실제 키 존재 여부를 반영하고,
  키가 하나도 없으면 전부 `false`, **`fixtures`는 반드시 `false`**
- 공고 상세 화면에서 `NEXT_PUBLIC_KAKAO_MAP_KEY`가 없으면 **KakaoMap 섹션 자체가 렌더되지 않는지** 확인

## 배포 후 확인

1. `/api/health`를 열어 `keys.*`가 Vercel에 실제로 등록한 키 상태를 반영하는지, `fixtures`가 `false`인지 확인
2. 대시보드·상세 화면이 실제 데이터로 채워지는지 확인
3. 지도가 안 보이면: (a) `NEXT_PUBLIC_KAKAO_MAP_KEY`를 넣은 뒤 **재배포했는지**, (b) 카카오 콘솔에 이 도메인이
   등록됐는지 순서로 확인한다

## Phase 8 잔여 — 배포 실패가 아니다

`lib/config.ts`에 `null`로 남은 상수가 **18개**다:

```
apartmentRealTransactionIndex (STATBL_ID)        1개
REBSTAT_REGION_CLS_ID 시도 코드                  17개  (전국 500001만 확정)
──────────────────────────────────────────────────
합계                                            18개
```

이 18개가 채워지기 전까지, **키를 다 넣어도 배포 후에도 계속 503으로 사라지는 게 정상이다:**

- **`/api/market/real-transaction`** — `apartmentRealTransactionIndex`가 `null`이라 항상 `REBSTAT_TABLE_UNKNOWN` → 503
- **`RegionMarket`(지역별 시세)** — 실제 공고의 `region`은 전부 17개 시도 중 하나인데 그 축이 전부 `null`이라 항상 `REBSTAT_REGION_UNMAPPED` → 503 → 섹션 숨김

Phase 8에서 실제 API 응답으로 이 18개 값을 확보하면 **코드 변경 없이** 두 섹션이 살아난다(§4.5④·부록 참조).
이 상태를 배포 실패로 오인하지 않는다.

## Phase 8 픽스처 교체 — 어느 것이 대상인지

픽스처 22개 중 **19개만 실제 응답으로 교체 대상**이다(`test/fixtures/applyhome/` 10 +
`test/fixtures/competition/` 7 + `test/fixtures/rebstat/` 2). **`test/fixtures/dev/`의 3개는
교체 대상이 아니다** — 실제 API에 없는 상태(접수기간 미정·접수중 무순위·모델번호 없는 경쟁률
폴백 조인)를 재현하기 위한 것이라 실제 응답으로 바꾸면 그 상태를 잃는다. 자세한 사유는
`test/fixtures/dev/README.md` 참조.
