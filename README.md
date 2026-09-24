# moveday

아파트 청약 공고를 **"언제 이사 갈 수 있는가"** 관점으로 보여주는 대시보드.

공고 목록과 마감 임박, 주택형별 분양가·경쟁률·당첨가점, 공급위치 지도, 지역 시세 흐름,
청약 가점 계산기를 한 화면에서 다룬다.

데이터는 **한국부동산원 청약홈**(공공데이터포털)과 **R-ONE 부동산통계**에서 가져온다.

---

## 빠르게 띄우기

```bash
pnpm install
cp .env.example .env.local     # 키를 채운다 (아래 참조)
pnpm dev                        # http://localhost:3000
```

**키가 없어도 화면 전체를 볼 수 있다.** `.env.local`에 이것만 넣으면 실제 응답을 캡처해둔
픽스처로 동작한다.

```
MOVEDAY_USE_FIXTURES=1
```

## 환경변수

| 이름 | 발급처 | 없을 때 |
|---|---|---|
| `ODCLOUD_SERVICE_KEY` | [공공데이터포털](https://www.data.go.kr) — **15098547**(분양정보)과 **15098905**(경쟁률·특별공급) 둘 다 활용신청. 키는 계정 공용이라 하나만 쓴다 | 공고 목록·상세가 503 |
| `REB_STAT_API_KEY` | [R-ONE](https://www.reb.or.kr/r-one/portal/openapi/openApiActKeyPage.do) — 포털이 아니라 R-ONE에서 직접 발급 | 시세 차트만 사라짐 |
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | [Kakao Developers](https://developers.kakao.com) — **JavaScript 키**. Web 플랫폼에 `http://localhost:3000` 등록 필요 | 지도 섹션만 사라짐 |
| `MOVEDAY_USE_FIXTURES` | (개발용) `1`이면 실호출 대신 픽스처 | 기본값 = 실호출 |

**공공데이터포털은 Decoding 키를 쓴다.** 이 앱은 키를 쿼리스트링이 아니라
`Authorization: Infuser {key}` 헤더로 보내므로, URL 인코딩된 Encoding 키를 넣으면
"등록되지 않은 인증키"가 된다.

**서버 키에 `NEXT_PUBLIC_` 접두어를 붙이지 않는다.** 클라이언트 번들에 그대로 실린다.
지도 키만 예외이고, 그건 노출이 정상인 값이라 카카오 콘솔에서 도메인을 제한해 보호한다.

키가 하나 없으면 **그 기능만** 사라지고 나머지는 정상 동작한다.

## 명령어

```bash
pnpm dev          # 개발 서버
pnpm test         # vitest (134개)
pnpm lint         # eslint
pnpm build        # 프로덕션 빌드
```

## 구조

Next.js 15 App Router 단일 앱이다. 별도 백엔드를 두지 않고 `app/api/*` Route Handler가
**인증키 숨기기 · 프록시 · 캐시 · 정규화**만 담당한다.

```
app/
  page.tsx                  대시보드
  notices/[id]/page.tsx     공고 상세
  score/page.tsx            가점 계산기
  api/
    notices/                목록 · 상세 · 경쟁률
    market/                 매매·전세 지수 · 실거래 지수
    health/                 키 존재 여부(불리언만)
lib/
  applyhome/                청약홈 클라이언트 + 유형별 어댑터
  rebstat/                  R-ONE 클라이언트 + 어댑터
  config.ts                 지역·유형·오퍼레이션·통계표 코드·캐시 TTL
components/                 화면 컴포넌트
test/
  fixtures/                 실제 API 응답 캡처
  *.test.ts                 정규화 계층 단위 테스트
```

### 정규화 계층이 이 프로젝트의 핵심이다

청약홈 API는 주택 유형 5종마다 **필드명·날짜 형식·접수 윈도우 개수가 전부 다르다.**
같은 "접수 시작일"이 유형에 따라 `SUBSCRPT_RCEPT_BGNDE`이기도 하고
`GNRL_RNK1_CRSPAREA_RCPTDE`이기도 하며, 날짜가 `2026-09-28`이기도 하고 `20260928`이기도 하다.

그래서 **raw 필드를 아는 곳은 어댑터뿐이고, 화면 코드는 raw 필드를 절대 참조하지 않는다.**
어댑터가 공통 `Notice` 타입으로 바꾼 뒤부터는 유형 분기가 사라진다.

단위 테스트는 이 계층에만 붙인다 — 날짜·금액 파싱, D-day 계산, 유형·지역 매핑,
표본 응답 감지. UI는 브라우저로 확인한다.

## 문서

| 문서 | 내용 |
|---|---|
| [`docs/DESIGN.md`](docs/DESIGN.md) | 설계 전체. 타입·API 계약·캐시·화면 정의, 그리고 **흡수한 함정과 그 근거** |
| [`docs/API-FIELDS.md`](docs/API-FIELDS.md) | 원본 API 필드 매핑. 실측으로 확정한 것과 미확인을 구분해 표기 |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Vercel 배포 체크리스트, 환경변수 재배포 조건, 장애 진단 |

`DESIGN.md`에는 구현 중 발견해 되돌린 판단들이 부록으로 남아 있다. 같은 조사를 반복하지
않기 위한 것이라, 비슷한 문제를 만나면 먼저 거기를 보는 편이 빠르다.

## 이번 범위에서 제외한 것

AI 분석, 알림(텔레그램/슬랙), 실거래가 개별 거래 조회, 스케줄 수집·DB 적재.

상세 화면 하단의 `AISection`은 플레이스홀더만 있고, 상세 응답·경쟁률·지역 통계 JSON을
그대로 프롬프트 입력으로 쓸 수 있게 필드를 갖춰뒀다 — 라우트 하나와 그 컴포넌트 내부만
채우면 되고 기존 코드는 고치지 않는다.
