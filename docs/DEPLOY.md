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

**도메인 제한은 포트까지 검사한다(2026-09-24 실측).** `http://localhost:3000`을 등록해도
`http://localhost:4321`은 거부된다. 다른 포트로 띄울 일이 있으면 그 포트도 따로 등록해야 한다.

```
Referer: http://localhost:3000/   → HTTP 200  text/javascript   (등록됨)
Referer: http://localhost:4321/   → HTTP 401  {"errorType":"AccessDeniedError",
                                    "message":"domain mismatched! caller=http://localhost:4321.
                                     check out registered web domains."}
Referer: https://moveday.vercel.app/ → HTTP 401  (배포 도메인 미등록 상태)
```

**거부됐을 때의 증상이 읽기 어렵다.** 카카오가 `<script>` 요청에 `401 application/json`을
돌려주면 크롬의 ORB(Opaque Response Blocking)가 응답을 차단해서, 콘솔에는 본문 대신
`net::ERR_BLOCKED_BY_ORB`만 찍힌다. `window.kakao`가 `undefined`로 남고 KakaoMap은
아무것도 렌더하지 않는다 — 화면상으로는 "키가 없을 때"와 구분되지 않는다.
원인을 가르는 한 줄:

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H 'Referer: https://<배포도메인>/' \
  "https://dapi.kakao.com/v2/maps/sdk.js?appkey=$KEY&autoload=false&libraries=services"
# 200이면 도메인 등록 OK(지도가 안 보이는 건 다른 이유), 401이면 도메인 미등록
```

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
2-1. **지도를 https에서 끝까지 태워본 적이 없다.** 카카오 SDK는 페이지 프로토콜을 그대로
   따르므로(로더 소스의 `"https:" == location.protocol ? "https:" : "http:"`) mixed content
   차단 위험은 없다고 판단했지만, 로컬 검증은 전부 `http://localhost:3000`에서 했다.
   배포 후 지도가 뜨는지를 첫 확인 항목으로 둔다
3. 지도가 안 보이면 콘솔을 먼저 본다. `net::ERR_BLOCKED_BY_ORB`가 보이면 **도메인 미등록**이고
   (위 curl 한 줄로 확정), 요청 자체가 없으면 `NEXT_PUBLIC_KAKAO_MAP_KEY`를 넣고 **재배포하지
   않은 것**이다. 요청이 200인데도 지도가 없으면 지오코딩이 주소를 못 찾은 것으로,
   이건 정상 동작이다(§9 — 실패하면 섹션을 숨긴다)

## 배포 후 정상 동작 기준 (2026-09-24 — Phase 8 완료 상태)

**세 키를 다 넣었으면 모든 섹션이 실데이터로 떠야 한다.** `lib/config.ts`에 `null`로 남은
상수는 없고(Phase 8에서 전부 확보), 픽스처는 실제 응답으로 교체됐다.

| 화면 | 정상 상태 |
|---|---|
| 대시보드 공고 목록 | 실제 공고. `sources[]`의 5개 유형이 전부 `ok: true` |
| 상세 — 경쟁률·특별공급·당첨가점 | APT는 다 뜬다. 접수 진행 중이거나 데이터가 아직 없는 공고는 **열이 비는 게 정상**(§4.4) |
| 상세 — 공급위치 지도 | 지오코딩 성공 시에만 렌더. 실패하면 섹션이 통째로 숨는 것이 설계다(§9) |
| MarketStrip · RegionMarket | 매매·전세·실거래 3개 지수 전부 |

**503이 보이면 그건 키 문제다.** Phase 8 이전처럼 "상수가 비어서 정상적으로 사라지는" 상태는
더 이상 없다.

### 에러가 아닌 빈 값 — 오인하지 말 것

| 증상 | 원인 | 정상인가 |
|---|---|---|
| 최근 1~2개월 지수가 없다 | 공표 지연(매매·전세 1개월, 실거래 2개월) | **정상.** `months`를 작게 요청하면 포인트가 0개일 수 있다 |
| 경쟁률 열이 통째로 없다 | 접수 진행 중이라 데이터가 아직 없다 | **정상**(§4.4 — 조인 실패는 에러가 아니다) |
| 지도가 안 뜬다 | 지오코딩 실패(지번이 실재하지 않는 등) | **정상**(§9). 단 콘솔에 `ERR_BLOCKED_BY_ORB`면 도메인 미등록이다 |
| 특별공급 섹션이 없다 | APT가 아닌 유형 | **정상.** 전용 오퍼레이션이 APT에만 있다 |
