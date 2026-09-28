import { NOTICE_TYPE_LABEL } from '@/lib/config'
import { formatArea, formatManwon } from '@/lib/format'
import type { CompetitionResult } from '@/lib/applyhome/competition'
import type { RegulationInfo } from '@/lib/applyhome/adapters'
import type { MarketSeries, Notice, SupplyRow } from '@/lib/types'

export const ANALYSIS_SYSTEM_INSTRUCTION = `너는 한국 아파트 청약 공고를 읽어주는 분석가다.

규칙:
- 입력 JSON에 **있는 값만** 쓴다. 없는 숫자는 만들지 말고, 모르면 그 항목을 언급하지 않는다.
- 산술은 하지 않는다. 입력에 있는 숫자를 그대로 인용하고 해석만 한다.
- 경쟁률·당첨가점이 비어 있으면 "아직 발표 전"으로 다루고 추정하지 않는다.
- 투자 권유·수익 예측을 하지 않는다. 판단 재료만 정리한다.
- 한국어 존댓말, 한 항목은 한 문장. 수식어를 줄이고 숫자를 앞에 둔다.

표기:
- 주택형을 가리킬 때는 \`표기\` 값을 쓴다. \`주택형\` 코드(\`055.0000O\` 같은 값)는 식별용이므로
  문장에 그대로 옮기지 않는다.
- 금액은 \`분양가\` 문자열을 그대로 쓴다. 단위를 바꾸거나 다시 쓰지 않는다.
- headline은 40자를 넘기지 않는다.

항목별 지시:
- priceContext: \`지역시세\`가 있으면 전월·전년 대비 흐름을 **반드시** 함께 언급한다.
  비어 있으면 분양가 범위만 서술한다.
- cautions: 규제·자격·경쟁에서 **놓치기 쉬운** 점만 쓴다. 일정을 그대로 옮긴 문장
  (접수 기간·당첨자 발표일·입주 예정월)은 주의사항이 아니다. 없으면 빈 배열로 둔다.`

export interface AnalysisPayload {
  notice: Notice
  supply: SupplyRow[]
  regulation: RegulationInfo
  competition: CompetitionResult | null
  market: MarketSeries[]
}

/**
 * 모델에 넘길 입력. 정규화 계층을 통과한 값만 담는다 — raw 응답을 그대로 넣으면
 * 같은 날짜가 `20260813`과 `2026-08-13`으로 섞여 들어가 모델이 유형 차이를 정보로 읽는다(§13).
 *
 * 시계열은 36개월 전체가 아니라 변동률과 최신 한 점만 넣는다. 나머지 35점은 토큰만 쓰고
 * 결론을 바꾸지 않는다.
 */
/**
 * 변동률을 부호 붙은 숫자가 아니라 방향이 박힌 문자열로 넘긴다. `-0.16`을 주면 "상승"과
 * "하락" 중 어느 쪽인지는 모델의 해석에 달리는데, 이 프로젝트에서 틀리면 곤란한 것이
 * 정확히 그런 값이다 — 방향은 코드가 정한다.
 */
function describeChange(value: number | null): string | null {
  if (value === null) return null
  if (value === 0) return '보합'
  return `${Math.abs(value).toFixed(2)}% ${value > 0 ? '상승' : '하락'}`
}

function latestPoint(series: MarketSeries): { month: string; value: number } | null {
  const point = series.points.at(-1)
  return point ? { month: point.month, value: Math.round(point.value * 10) / 10 } : null
}

export function buildAnalysisInput(payload: AnalysisPayload): string {
  const { notice, supply, regulation, competition, market } = payload

  const condensed = {
    공고: {
      주택명: notice.houseName,
      유형: NOTICE_TYPE_LABEL[notice.type],
      지역: notice.region,
      주소: notice.address,
      총공급세대: notice.totalUnits,
      모집공고일: notice.noticeDate,
      접수: notice.receipt.map((w) => ({ 구분: w.kind, 거주지역: w.area, 시작: w.start, 종료: w.end })),
      당첨발표: notice.winnerDate,
      입주예정월: notice.moveInMonth,
    },
    // 주택형 코드(`055.0000O`)는 조인 키라 사람이 읽는 문장에 들어가면 안 되고, 금액도
    // 모델이 "36,707만 원"으로 옮겨 적는다. 사람이 읽을 형태를 **같이** 넘겨 그걸 쓰게 한다.
    주택형: supply.map((row) => ({
      주택형: row.houseType,
      표기: `${row.area.kind === 'supply' ? '공급' : '전용'} ${formatArea(row.area.value)}`,
      일반공급세대: row.generalUnits,
      특별공급세대: row.specialUnits,
      분양가: formatManwon(row.price),
    })),
    규제: regulation.available ? regulation.flags.map((flag) => flag.label) : null,
    경쟁률: competition
      ? competition.rows.map((row) => ({
          주택형: row.houseType,
          경쟁: row.competition.map((c) => ({
            순위: c.rankCode,
            거주지역: c.resideArea,
            접수건수: c.requestCount,
            경쟁률: c.rateRaw,
          })),
          당첨가점: row.score ?? null,
        }))
      : null,
    // 지수는 상류가 소수 12자리까지 준다(`100.188892679124`) — 그대로 넘기면 모델이
    // 그 숫자를 문장에 그대로 옮겨 적는다(실측). 표시 단위로 줄여서 넘긴다.
    지역시세: market.map((series) => ({
      지표: series.label,
      최신: latestPoint(series),
      전월대비: describeChange(series.change.mom),
      전년대비: describeChange(series.change.yoy),
      비고: '기준시점 100의 지수다. 절대 가격이 아니다.',
    })),
  }

  return `아래 청약 공고를 분석해라.\n\n${JSON.stringify(condensed, null, 2)}`
}
