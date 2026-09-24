import { NOTICE_TYPE_LABEL } from '@/lib/config'
import type { CompetitionResult } from '@/lib/applyhome/competition'
import type { RegulationInfo } from '@/lib/applyhome/adapters'
import type { MarketSeries, Notice, SupplyRow } from '@/lib/types'

export const ANALYSIS_SYSTEM_INSTRUCTION = `너는 한국 아파트 청약 공고를 읽어주는 분석가다.

규칙:
- 입력 JSON에 **있는 값만** 쓴다. 없는 숫자는 만들지 말고, 모르면 그 항목을 언급하지 않는다.
- 산술은 하지 않는다. 입력에 있는 숫자를 그대로 인용하고 해석만 한다.
- 경쟁률·당첨가점이 비어 있으면 "아직 발표 전"으로 다루고 추정하지 않는다.
- 투자 권유·수익 예측을 하지 않는다. 판단 재료만 정리한다.
- 한국어 존댓말, 한 항목은 한 문장. 수식어를 줄이고 숫자를 앞에 둔다.`

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
    주택형: supply.map((row) => ({
      주택형: row.houseType,
      면적: row.area.value,
      면적종류: row.area.kind === 'supply' ? '공급면적' : '전용면적',
      일반공급세대: row.generalUnits,
      특별공급세대: row.specialUnits,
      분양가만원: row.price,
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
    지역시세: market.map((series) => ({
      지표: series.label,
      최신: series.points.at(-1) ?? null,
      전월대비퍼센트: series.change.mom,
      전년대비퍼센트: series.change.yoy,
      비고: '기준시점 100의 지수다. 절대 가격이 아니다.',
    })),
  }

  return `아래 청약 공고를 분석해라.\n\n${JSON.stringify(condensed, null, 2)}`
}
