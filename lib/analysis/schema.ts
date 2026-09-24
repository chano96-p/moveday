import { z } from 'zod'

/**
 * 분석 결과의 유일한 정의. 화면 렌더·응답 검증·Gemini에 넘길 JSON Schema가 전부 여기서 나온다.
 * 모델이 자유 문장을 뱉게 두면 화면에 넣을 수도, 틀렸는지 확인할 수도 없다(§13).
 */
export const AnalysisSchema = z.object({
  verdict: z
    .enum(['competitive', 'moderate', 'accessible'])
    .describe('경쟁 강도. competitive=경쟁이 치열함, moderate=보통, accessible=상대적으로 진입이 쉬움'),
  headline: z.string().describe('한 문장 요약. 40자 이내. 숫자를 하나 이상 포함할 것'),
  reasons: z
    .array(z.string().describe('근거 한 줄. 반드시 입력 데이터에 있는 숫자를 인용할 것'))
    .min(2)
    .max(4)
    .describe('verdict의 근거'),
  priceContext: z
    .string()
    .describe('분양가를 지역 시세 흐름과 대비해 한두 문장. 시세 데이터가 없으면 분양가 범위만 서술할 것'),
  cautions: z
    .array(z.string().describe('주의할 점 한 줄'))
    .max(3)
    .describe('규제·일정·자격에서 놓치기 쉬운 점. 없으면 빈 배열'),
})

export type NoticeAnalysis = z.infer<typeof AnalysisSchema>

/**
 * Gemini `response_format.schema`로 넘길 형태. zod에서 뽑아 쓰는 이유는 스키마를 두 벌
 * 들고 있으면 한쪽만 고쳤을 때 **모델은 새 필드를 채웠는데 파싱에서 떨어지는** 조합이
 * 말없이 생기기 때문이다. `$schema`는 JSON Schema 메타 키라 빼고 넘긴다.
 */
export function analysisJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(AnalysisSchema) as Record<string, unknown>
  delete schema.$schema
  return schema
}

export const VERDICT_LABEL: Record<NoticeAnalysis['verdict'], string> = {
  competitive: '경쟁 치열',
  moderate: '보통',
  accessible: '진입 여지 있음',
}
