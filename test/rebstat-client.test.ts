import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchRebstatRows } from '@/lib/rebstat/client'
import { RebstatSampleResponseError, RebstatUpstreamError } from '@/lib/errors'

// 2023-06 ~ 2026-09, 40개월 연속 — 실제 rebstat 픽스처와 같은 폭.
function fortyMonthsFrom202306(): { WRTTIME_IDTFR_ID: string; DTA_VAL: number }[] {
  const rows: { WRTTIME_IDTFR_ID: string; DTA_VAL: number }[] = []
  let year = 2023
  let month = 6
  for (let i = 0; i < 40; i++) {
    rows.push({ WRTTIME_IDTFR_ID: `${year}${String(month).padStart(2, '0')}`, DTA_VAL: 90 + i })
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return rows
}

function stubUpstreamResponse() {
  // 상류가 START_WRTTIME/END_WRTTIME을 무시하고(§4.5⑤ 미검증) 전체 40건을 그대로 준다고 가정한다
  // — 리뷰어가 실측한 시나리오. pSize=300을 그대로 흘려보내는 상황과 같다.
  return {
    SttsApiTblData: [{ head: [{ RESULT: { CODE: 'INFO-000', MESSAGE: '정상' } }] }, { row: fortyMonthsFrom202306() }],
  }
}

// BLOCKER 회귀 테스트 — clampToRange가 픽스처 경로에만 걸려 있어 원격 경로가 무방비였다.
// 픽스처 모드로는 이 버그를 다시 못 잡으므로, 여기서는 fetch를 직접 스텁해 원격 경로를 태운다.
describe('fetchRebstatRows — 원격 경로(픽스처 미사용)에서도 요청 기간으로 잘린다', () => {
  beforeEach(() => {
    delete process.env.MOVEDAY_USE_FIXTURES
    process.env.REB_STAT_API_KEY = 'dummy-test-key'
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, text: async () => JSON.stringify(stubUpstreamResponse()) } as Response)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.REB_STAT_API_KEY
  })

  const cases: { months: number; startWrttime: string; endWrttime: string; expected: number }[] = [
    { months: 1, startWrttime: '202609', endWrttime: '202609', expected: 1 },
    { months: 12, startWrttime: '202510', endWrttime: '202609', expected: 12 },
    { months: 24, startWrttime: '202410', endWrttime: '202609', expected: 24 },
    { months: 36, startWrttime: '202310', endWrttime: '202609', expected: 36 },
  ]

  for (const { months, startWrttime, endWrttime, expected } of cases) {
    it(`months=${months} 요청이면 상류가 40건을 줘도 ${expected}건만 반환한다`, async () => {
      const rows = await fetchRebstatRows({
        // 오퍼레이션(=STATBL_ID)마다 dedupe 키가 갈리게 매번 다른 값을 쓴다.
        statblId: `TEST_STATBL_${months}`,
        clsId: 500001,
        itmId: 100001,
        dtacycleCd: 'MM',
        startWrttime,
        endWrttime,
        months,
        revalidate: 60,
      })
      expect(rows).toHaveLength(expected)
    })
  }
})

// clampToRange가 isSampleResponse보다 먼저 적용돼야 한다 — 순서가 바뀌면(자르기 전 전체
// 건수로 판정) KEY 미적용 시의 고정 표본 5건이 마침 요청 기간 밖이라 클램프 후 0건이 되는
// 경우를 못 잡는다.
describe('fetchRebstatRows — clamp 후 표본 응답 판정(순서 회귀)', () => {
  beforeEach(() => {
    delete process.env.MOVEDAY_USE_FIXTURES
    process.env.REB_STAT_API_KEY = 'dummy-test-key'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.REB_STAT_API_KEY
  })

  it('KEY 미적용 표본 5건이 요청 기간(월 1개월) 밖이면 clamp 후 0건이 되고 SAMPLE_RESPONSE로 잡힌다', async () => {
    // §4.5① — KEY 없이도 에러가 아니라 고정된 실제 데이터 5건이 온다. 그 5건이 2023년치라
    // 2026-09만 요청한 이번 케이스에서는 clamp 후 전부 빠진다.
    const sampleRows = Array.from({ length: 5 }, (_, i) => ({
      WRTTIME_IDTFR_ID: `2023${String(i + 1).padStart(2, '0')}`,
      DTA_VAL: 90 + i,
    }))
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ SttsApiTblData: [{ head: [{ RESULT: { CODE: 'INFO-000' } }] }, { row: sampleRows }] }),
    } as Response)

    await expect(
      fetchRebstatRows({
        statblId: 'TEST_STATBL_ORDER',
        clsId: 500001,
        itmId: 100001,
        dtacycleCd: 'MM',
        startWrttime: '202609',
        endWrttime: '202609',
        months: 1,
        revalidate: 60,
      }),
    ).rejects.toThrow(RebstatSampleResponseError)
  })
})

// ERROR-290(키 무효) 외의 RESULT.CODE도 상류 문제이지 우리 코드 버그가 아니다 — 일반 Error로
// 새면 라우트가 500으로 떨어져(팀 리드 지적) 로그에서 원인을 못 가른다. 502로 매핑돼야 한다.
describe('fetchRebstatRows — 그 외 RESULT.CODE는 502로 매핑된다(500 회귀)', () => {
  beforeEach(() => {
    delete process.env.MOVEDAY_USE_FIXTURES
    process.env.REB_STAT_API_KEY = 'dummy-test-key'
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ SttsApiTblData: [{ head: [{ RESULT: { CODE: 'ERROR-500', MESSAGE: '서버 오류' } }] }, { row: [] }] }),
    } as Response)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.REB_STAT_API_KEY
  })

  it('ERROR-290이 아닌 에러 코드는 RebstatUpstreamError(502)로 던진다', async () => {
    await expect(
      fetchRebstatRows({
        statblId: 'TEST_STATBL_UPSTREAM_ERROR',
        clsId: 500001,
        itmId: 100001,
        dtacycleCd: 'MM',
        startWrttime: '202609',
        endWrttime: '202609',
        months: 1,
        revalidate: 60,
      }),
    ).rejects.toThrow(RebstatUpstreamError)
  })
})

// HTTP 레벨 실패(5xx가 HTML 오류 페이지를 실어 보내는 경우)를 검사하지 않으면 xml 파서가
// 그럭저럭 파싱해 빈 rows가 되고 SAMPLE_RESPONSE로 오보된다 — "상류가 죽었다"가 "키가
// 미적용됐다"로 둔갑한다. res.ok를 봐서 502로 분류돼야 한다.
describe('fetchRebstatRows — HTTP 5xx도 502로 매핑된다(SAMPLE_RESPONSE 오보 회귀)', () => {
  beforeEach(() => {
    delete process.env.MOVEDAY_USE_FIXTURES
    process.env.REB_STAT_API_KEY = 'dummy-test-key'
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => '<html><body>Bad Gateway</body></html>',
    } as Response)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.REB_STAT_API_KEY
  })

  it('res.ok가 false면 RebstatUpstreamError(502)로 던지고 SAMPLE_RESPONSE로 오보하지 않는다', async () => {
    await expect(
      fetchRebstatRows({
        statblId: 'TEST_STATBL_HTTP_5XX',
        clsId: 500001,
        itmId: 100001,
        dtacycleCd: 'MM',
        startWrttime: '202609',
        endWrttime: '202609',
        months: 36,
        revalidate: 60,
      }),
    ).rejects.toThrow(RebstatUpstreamError)
  })
})
