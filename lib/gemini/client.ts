import { GEMINI_BASE, GEMINI_MODEL } from '@/lib/config'
import { AnalysisKeyMissingError, AnalysisRateLimitedError, AnalysisUpstreamError } from '@/lib/errors'

export function assertGeminiKey(): void {
  if (!process.env.GEMINI_API_KEY) throw new AnalysisKeyMissingError()
}

interface InteractionContent {
  type?: unknown
  text?: unknown
}

interface InteractionStep {
  type?: unknown
  content?: unknown
}

/**
 * Interactions API 응답에서 모델이 쓴 텍스트만 뽑는다.
 *
 * SDK의 `output_text`는 편의 접근자일 뿐 REST 본문에 없다. 그렇다고
 * `steps[steps.length - 1].content[0].text`로 잡으면 마지막 step이 사고 과정이나
 * 도구 호출일 때 빈 문자열이 나온다 — `model_output` step만 골라 이어붙인다.
 */
export function extractOutputText(body: unknown): string {
  const steps = (body as { steps?: unknown })?.steps
  if (!Array.isArray(steps)) return ''

  const chunks: string[] = []
  for (const step of steps as InteractionStep[]) {
    if (step?.type !== 'model_output' || !Array.isArray(step.content)) continue
    for (const item of step.content as InteractionContent[]) {
      if (item?.type === 'text' && typeof item.text === 'string') chunks.push(item.text)
    }
  }
  return chunks.join('')
}

/**
 * `response_format`으로 JSON을 강제하고, 모델이 쓴 텍스트를 파싱해 돌려준다.
 * 반환값의 형태는 보장하지 않는다 — 호출부가 zod로 검증한다.
 */
export async function generateJson(args: {
  systemInstruction: string
  input: string
  schema: Record<string, unknown>
  maxOutputTokens: number
}): Promise<unknown> {
  const response = await fetch(GEMINI_BASE, {
    method: 'POST',
    headers: {
      'x-goog-api-key': process.env.GEMINI_API_KEY as string,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      system_instruction: args.systemInstruction,
      input: args.input,
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: args.schema,
      },
      generation_config: {
        max_output_tokens: args.maxOutputTokens,
        // 분석문은 길지 않고 Vercel 함수 타임아웃이 짧다 — 사고 단계를 낮게 묶는다.
        thinking_level: 'low',
      },
    }),
  })

  // 무료 티어에서 실제로 마주치는 실패는 키 오류가 아니라 분당·일일 한도다.
  // 화면에서 "잠시 후 다시"와 "설정이 잘못됨"을 구분해야 해서 코드를 나눈다.
  if (response.status === 429) throw new AnalysisRateLimitedError()
  if (!response.ok) throw new AnalysisUpstreamError()

  const text = extractOutputText(await response.json())
  if (text === '') throw new AnalysisUpstreamError()

  try {
    return JSON.parse(text)
  } catch {
    throw new AnalysisUpstreamError()
  }
}
