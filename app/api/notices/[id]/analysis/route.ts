import { unstable_cache } from 'next/cache'
import { z } from 'zod'
import { CACHE_TTL, GEMINI_MODEL, NOTICE_TYPES } from '@/lib/config'
import { assertOdcloudKey } from '@/lib/applyhome/client'
import { fetchNoticeDetail } from '@/lib/applyhome/detail'
import { fetchCompetitionResult } from '@/lib/applyhome/competition'
import { fetchSalePriceSeriesOrNull } from '@/lib/rebstat/market'
import { assertGeminiKey, generateJson } from '@/lib/gemini/client'
import { AnalysisSchema, analysisJsonSchema } from '@/lib/analysis/schema'
import { ANALYSIS_SYSTEM_INSTRUCTION, buildAnalysisInput } from '@/lib/analysis/prompt'
import { AnalysisUpstreamError, toErrorResponse } from '@/lib/errors'
import type { NoticeType } from '@/lib/types'

const QuerySchema = z.object({
  type: z.enum(NOTICE_TYPES),
})

const MARKET_MONTHS = 24
const MAX_OUTPUT_TOKENS = 1024

// unstable_cache는 반환값을 직렬화해 저장한다 — Symbol 센티널은 캐시를 통과하지 못하고
// undefined로 돌아온다. "없음"은 null로 표현한다.
async function analyze(id: string, type: NoticeType) {
  const detail = await fetchNoticeDetail(id, type, CACHE_TTL.analysis)
  if (detail === null) return null

  const [competition, market] = await Promise.all([
    fetchCompetitionResult(detail.notice, CACHE_TTL.analysis),
    fetchSalePriceSeriesOrNull(detail.notice.region ?? '전국', MARKET_MONTHS),
  ])

  const raw = await generateJson({
    systemInstruction: ANALYSIS_SYSTEM_INSTRUCTION,
    input: buildAnalysisInput({
      notice: detail.notice,
      supply: detail.supply,
      regulation: detail.regulation,
      competition,
      market: market ? [market] : [],
    }),
    schema: analysisJsonSchema(),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  })

  // `response_format`을 줘도 스키마 준수는 상류의 약속일 뿐이다. 여기서 떨어뜨리지 않으면
  // 필드가 빠진 객체가 캐시에 24시간 박히고 화면은 빈 칸을 그린다.
  const parsed = AnalysisSchema.safeParse(raw)
  if (!parsed.success) throw new AnalysisUpstreamError()

  return {
    analysis: parsed.data,
    model: GEMINI_MODEL,
    generatedAt: new Date().toISOString(),
    inputs: {
      competition: competition !== null,
      market: market !== null,
    },
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({ type: url.searchParams.get('type') ?? undefined })
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_QUERY', issues: parsed.error.issues }, { status: 400 })
  }
  const { type } = parsed.data

  try {
    // 청약홈·R-ONE을 먼저 부르고 나서 키가 없는 걸 알면 그 호출이 통째로 버려진다.
    // 일일 한도가 있는 개발계정이라 순서를 뒤집지 않는다.
    assertGeminiKey()
    assertOdcloudKey()

    // 한 공고의 분석은 하루 한 번만 생성한다. 무료 티어의 한도는 방문자 수가 아니라
    // **공고 수**만큼만 쓰이게 된다 — 같은 공고를 백 명이 눌러도 호출은 한 번이다.
    const result = await unstable_cache(
      () => analyze(id, type),
      ['notice-analysis', id, type],
      { revalidate: CACHE_TTL.analysis },
    )()

    if (result === null) {
      return Response.json({ error: 'NOTICE_NOT_FOUND' }, { status: 404 })
    }

    return Response.json(result)
  } catch (error) {
    return toErrorResponse(error)
  }
}
