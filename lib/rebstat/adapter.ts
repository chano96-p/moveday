import { format, parseISO, subMonths } from 'date-fns'
import { todayInSeoul } from '@/lib/dday'
import { REBSTAT_REGION_CLS_ID, type RebstatTableId } from '@/lib/config'
import type { MarketSeries, Region } from '@/lib/types'
import type { RebstatRow } from './parse'

/**
 * 지역명 대신 `CLS_ID`로 매핑한다(§4.0) — `CLS_FULLNM`은 표시용 문자열이고
 * 전남광주통합특별시 출범으로 표기가 바뀔 수 있어 로직 기준으로 쓰면 안 된다.
 *
 * `CLS_ID`는 지역만으로 정해지지 않는다 — **통계표(`statblId`)마다 다른 코드 체계**를
 * 쓴다(Phase 8 실측). `statblId`를 `RebstatTableId`로 받아 어느 표에 대한 요청인지
 * 타입으로 강제한다 — 다음 통계표를 추가할 때 이 인자를 빼먹으면 컴파일이 깨진다.
 */
export function clsIdFor(region: Region | '전국', statblId: RebstatTableId): number | null {
  return REBSTAT_REGION_CLS_ID[statblId]?.[region] ?? null
}

/** `months`개월치를 요청하기 위한 `WRTTIME_IDTFR_ID`(YYYYMM) 범위. KST 기준 "오늘"이 끝이다. */
export function monthRangeFor(months: number, now: Date = new Date()): { startWrttime: string; endWrttime: string } {
  const today = todayInSeoul(now)
  return {
    startWrttime: format(subMonths(today, months - 1), 'yyyyMM'),
    endWrttime: format(today, 'yyyyMM'),
  }
}

function toPoint(row: RebstatRow): { month: string; value: number } {
  const raw = row.WRTTIME_IDTFR_ID
  return { month: `${raw.slice(0, 4)}-${raw.slice(4, 6)}`, value: row.DTA_VAL }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

// 전월 대비(mom)·전년 동월 대비(yoy)는 서버에서 계산한다(§5) — 프론트는 배지만 그린다.
function computeChange(points: { month: string; value: number }[]): { mom: number | null; yoy: number | null } {
  if (points.length === 0) return { mom: null, yoy: null }
  const byMonth = new Map(points.map((p) => [p.month, p.value]))
  const latest = points[points.length - 1]
  const latestDate = parseISO(`${latest.month}-01`)

  const prevMonthValue = byMonth.get(format(subMonths(latestDate, 1), 'yyyy-MM'))
  const prevYearValue = byMonth.get(format(subMonths(latestDate, 12), 'yyyy-MM'))

  const mom = prevMonthValue !== undefined && prevMonthValue !== 0 ? round2(((latest.value - prevMonthValue) / prevMonthValue) * 100) : null
  const yoy = prevYearValue !== undefined && prevYearValue !== 0 ? round2(((latest.value - prevYearValue) / prevYearValue) * 100) : null

  return { mom, yoy }
}

export function toMarketSeries(key: MarketSeries['key'], label: string, rows: RebstatRow[]): MarketSeries {
  const points = rows
    // DTA_VAL이 숫자가 아닌 행(null·문자열 등)이 오면 차트에 끊긴 점이 찍힌다 — 걸러낸다.
    .filter((row) => typeof row.DTA_VAL === 'number' && Number.isFinite(row.DTA_VAL))
    .map(toPoint)
    .sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0))
  return { key, label, points, change: computeChange(points) }
}
