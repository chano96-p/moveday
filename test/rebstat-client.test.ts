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

// 팀 리드 실측 — list_total_count(상류가 보고하는 전체 건수)와 실제 받은 행 수를 비교해
// 판별한다. 예전 기준(요청 개월수 vs 받은 행 수)은 공표 지연으로 실제 건수가 적은 정상
// 응답을 샘플로 오판했다 — months=6인데 실제 공표가 5개월치뿐이면 오탐이었다.
describe('fetchRebstatRows — list_total_count 기준 표본 판정', () => {
  beforeEach(() => {
    delete process.env.MOVEDAY_USE_FIXTURES
    process.env.REB_STAT_API_KEY = 'dummy-test-key'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.REB_STAT_API_KEY
  })

  function rowsFor(count: number, endYyyymm = '202609') {
    const [endYear, endMonth] = [Number(endYyyymm.slice(0, 4)), Number(endYyyymm.slice(4, 6))]
    return Array.from({ length: count }, (_, i) => {
      const monthIndex = endMonth - 1 - (count - 1 - i)
      const year = endYear + Math.floor(monthIndex / 12)
      const month = ((monthIndex % 12) + 12) % 12
      return { WRTTIME_IDTFR_ID: `${year}${String(month + 1).padStart(2, '0')}`, DTA_VAL: 90 + i }
    })
  }

  it('KEY 미적용으로 잘려서 list_total_count(6)보다 적은 행(5)만 오면 SAMPLE_RESPONSE로 잡는다', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          SttsApiTblData: [
            { head: [{ list_total_count: 6 }, { RESULT: { CODE: 'INFO-000' } }] },
            { row: rowsFor(5) }, // 6개월 요청인데 5건만 옴 — 잘린 것
          ],
        }),
    } as Response)

    await expect(
      fetchRebstatRows({
        statblId: 'TEST_STATBL_TRUNCATED',
        clsId: 500001,
        itmId: 100001,
        dtacycleCd: 'MM',
        startWrttime: '202604',
        endWrttime: '202609',
        months: 6,
        revalidate: 60,
      }),
    ).rejects.toThrow(RebstatSampleResponseError)
  })

  it('공표 지연으로 실제 건수가 5건뿐이어도 list_total_count도 5면 샘플이 아니다(BLOCKER 회귀)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          SttsApiTblData: [
            { head: [{ list_total_count: 5 }, { RESULT: { CODE: 'INFO-000' } }] },
            { row: rowsFor(5, '202608') }, // 6개월 요청이지만 최신 공표가 2026-08까지뿐이라 5건
          ],
        }),
    } as Response)

    const rows = await fetchRebstatRows({
      statblId: 'TEST_STATBL_LAG',
      clsId: 500001,
      itmId: 100001,
      dtacycleCd: 'MM',
      startWrttime: '202604',
      endWrttime: '202609',
      months: 6,
      revalidate: 60,
    })
    expect(rows).toHaveLength(5)
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

// 팀 리드 실측 — 샘플 판정은 클램프 **전** 건수로 해야 한다. list_total_count는 상류가 서버 측
// 필터를 적용한 뒤 보고하는 총건수이므로 "상류가 잘랐는가"를 재는 값이고, 클램프는 우리가
// 추가로 거르는 단계다. 둘을 섞으면 상류가 범위를 무시했을 때 클램프가 구해준 정상 데이터가
// SAMPLE_RESPONSE로 버려진다 — 클램프가 존재하는 이유가 바로 그 시나리오다.
describe('fetchRebstatRows — 상류가 범위를 무시해도 표본으로 오판하지 않는다', () => {
  beforeEach(() => {
    delete process.env.MOVEDAY_USE_FIXTURES
    process.env.REB_STAT_API_KEY = 'dummy-test-key'
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          SttsApiTblData: [
            // 상류가 START/END_WRTTIME을 무시하고 전체 40건을 주면서 총건수도 40으로 보고한다.
            { head: [{ list_total_count: 40 }, { RESULT: { CODE: 'INFO-000' } }] },
            { row: fortyMonthsFrom202306() },
          ],
        }),
    } as Response)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.REB_STAT_API_KEY
  })

  it('12개월을 요청하면 클램프된 12건이 나온다 — 클램프 후 건수(12)와 40을 비교하면 오판한다', async () => {
    const rows = await fetchRebstatRows({
      statblId: 'TEST_STATBL_UNFILTERED',
      clsId: 500001,
      itmId: 100001,
      dtacycleCd: 'MM',
      startWrttime: '202510',
      endWrttime: '202609',
      months: 12,
      revalidate: 60,
    })
    expect(rows).toHaveLength(12)
  })
})

// 팀 리드 실측 — INFO-200("해당하는 데이터가 없습니다")은 접두어가 INFO-라 에러가 아니라
// 조회 결과 없음이다. 공표 지연(매매·전세 1개월, 실거래 2개월) 때문에 최근 1~2개월을
// 요청하면 정상적으로 이게 온다. 에러로 올리면 §5가 계약한 months=1이 502가 된다.
describe('fetchRebstatRows — INFO-200은 빈 결과다', () => {
  beforeEach(() => {
    delete process.env.MOVEDAY_USE_FIXTURES
    process.env.REB_STAT_API_KEY = 'dummy-test-key'
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      // 래퍼 없이 RESULT만 단독으로 온다(§4.5③) — 실측 원문 그대로.
      text: async () => JSON.stringify({ RESULT: { CODE: 'INFO-200', MESSAGE: '해당하는 데이터가 없습니다.' } }),
    } as Response)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.REB_STAT_API_KEY
  })

  it('빈 배열을 반환한다 — 던지지 않는다', async () => {
    const rows = await fetchRebstatRows({
      statblId: 'TEST_STATBL_NODATA',
      clsId: 500001,
      itmId: 100001,
      dtacycleCd: 'MM',
      startWrttime: '202609',
      endWrttime: '202609',
      months: 1,
      revalidate: 60,
    })
    expect(rows).toEqual([])
  })
})
