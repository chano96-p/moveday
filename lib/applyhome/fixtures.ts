import { readFileSync } from 'node:fs'
import path from 'node:path'
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { todayInSeoul } from '@/lib/dday'

/**
 * `MOVEDAY_USE_FIXTURES=1`일 때만 상류 호출 대신 로컬 픽스처를 읽어 반환한다.
 * 인증키가 없어도 브라우저로 화면을 확인할 수 있게 하는 개발용 경로다(팀 리드 지시).
 * 기본은 비활성 — 변수가 없으면 이 모듈은 아예 쓰이지 않는다.
 */
export function isFixtureModeEnabled(): boolean {
  return process.env.MOVEDAY_USE_FIXTURES === '1'
}

const FIXTURE_DIR = path.join(process.cwd(), 'test/fixtures/applyhome')
const COMPETITION_FIXTURE_DIR = path.join(process.cwd(), 'test/fixtures/competition')
const DEV_FIXTURE_DIR = path.join(process.cwd(), 'test/fixtures/dev')

// 오퍼레이션명 → test/fixtures/applyhome 파일명. 이 10개는 Phase 8 대조군이라 건드리지 않는다.
const OPERATION_FIXTURE_FILE: Record<string, string> = {
  getAPTLttotPblancDetail: 'apt-detail.json',
  getAPTLttotPblancMdl: 'apt-mdl.json',
  getRemndrLttotPblancDetail: 'remndr-detail.json',
  getRemndrLttotPblancMdl: 'remndr-mdl.json',
  getUrbtyOfctlLttotPblancDetail: 'urbty-detail.json',
  getUrbtyOfctlLttotPblancMdl: 'urbty-mdl.json',
  getPblPvtRentLttotPblancDetail: 'rent-detail.json',
  getPblPvtRentLttotPblancMdl: 'rent-mdl.json',
  getOPTLttotPblancDetail: 'opt-detail.json',
  getOPTLttotPblancMdl: 'opt-mdl.json',
}

// 오퍼레이션명 → test/fixtures/competition 파일명(§3 (B) 8개). `getPblPvtRentLttotPblancCmpet`은
// 의도적으로 없다 — /api/notices/{id}/competition의 204 경로를 재현하기 위한 것이다(README 참조).
const COMPETITION_OPERATION_FIXTURE_FILE: Record<string, string> = {
  getAPTLttotPblancCmpet: 'apt-cmpet.json',
  getUrbtyOfctlLttotPblancCmpet: 'urbty-cmpet.json',
  getRemndrLttotPblancCmpet: 'remndr-cmpet.json',
  getCancResplLttotPblancCmpet: 'canc-respl-cmpet.json',
  getOPTLttotPblancCmpet: 'opt-cmpet.json',
  getAptLttotPblancScore: 'apt-score.json',
  getAPTSpsplyReqstStus: 'apt-special-supply.json',
}

// 오퍼레이션명 → test/fixtures/dev 추가 픽스처(선택). 기본 10개 픽스처가 전부 마감/예정으로만
// 치우쳐 있어 `open`·`unknown` 상태를 화면에서 확인할 수 없으므로 유형별로 하나씩 보강한다.
// `getRemndrLttotPblancMdl`은 Phase 4에서 추가 — REMNDR(HOUSE_SECD=04) dev 공고에 원래
// Mdl 픽스처가 없어 houseTypeKey 폴백 조인을 화면에서 확인할 방법이 없었다.
const DEV_EXTRA_FIXTURE_FILE: Record<string, string> = {
  getAPTLttotPblancDetail: 'apt-detail-extra.json',
  getRemndrLttotPblancDetail: 'remndr-detail-extra.json',
  getRemndrLttotPblancMdl: 'remndr-mdl-extra.json',
}

// applyhome 픽스처 README가 밝힌 캡처 기준일. 이 날짜를 오늘로 보고 모든 날짜 필드를
// 같은 일수만큼 이동시켜, 언제 `pnpm dev`를 켜도 접수중/예정 케이스가 살아있게 한다.
const FIXTURE_ANCHOR_DATE = '2026-09-24'

// 픽스처 건수가 적어 캐시할 이유가 없다 — `pnpm dev`를 켜둔 채 자정을 넘겨도 매번 다시 계산해
// 시프트가 하루 어긋나는 일이 없게 한다.
// 단위 테스트가 결정적 기대값을 계산하려면 이 함수도 필요하다(`test/fixtures.test.ts`).
export function shiftDays(): number {
  return differenceInCalendarDays(todayInSeoul(), parseISO(FIXTURE_ANCHOR_DATE))
}

// 순수 함수라 단위 테스트로 검증한다(`test/fixtures.test.ts`) — MAJOR였던 전화번호 변조
// 회귀를 잡기 위한 예외다. §4.6이 정한 7개 테스트 범위 밖이지만 팀 리드가 승인했다.
export function shiftDateString(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = parseISO(value)
    if (Number.isNaN(parsed.getTime())) return value
    return format(addDays(parsed, shiftDays()), 'yyyy-MM-dd')
  }
  if (/^\d{8}$/.test(value)) {
    const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
    const parsed = parseISO(iso)
    // MDHS_TELNO("16001004") 같은 전화번호도 8자리 숫자라 이 정규식에 걸린다.
    // 연도가 2000 미만이거나 파싱 자체가 실패하면 날짜가 아니라고 보고 그대로 둔다.
    if (Number.isNaN(parsed.getTime()) || parsed.getFullYear() < 2000) return value
    return format(addDays(parsed, shiftDays()), 'yyyyMMdd')
  }
  return value
}

// raw 응답 트리를 훑어 `yyyy-MM-dd`/`yyyyMMdd` 형식 문자열만 시프트한다.
// 전화번호처럼 8자리 숫자와 우연히 겹치는 필드는 위 연도 가드로 걸러낸다.
function shiftDatesDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shiftDatesDeep)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, shiftDatesDeep(v)]))
  }
  if (typeof value === 'string') return shiftDateString(value)
  return value
}

function readFixtureData(filePath: string): Record<string, unknown>[] {
  const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as { data: Record<string, unknown>[] }
  return parsed.data
}

function applyCond(rows: Record<string, unknown>[], cond?: Record<string, string>): Record<string, unknown>[] {
  if (!cond) return rows
  return rows.filter((row) =>
    Object.entries(cond).every(([key, value]) => {
      const [field, op] = key.split('::')
      const rowValue = row[field]
      if (op === 'EQ') return String(rowValue) === value
      if (op === 'GTE') return typeof rowValue === 'string' && rowValue >= value
      return true
    }),
  )
}

/**
 * 픽스처 모드에서 오퍼레이션 + cond에 대응하는 행을 반환한다.
 * 실제 odcloud 응답과 달리 페이지네이션 없이 전체를 한 번에 준다 — 픽스처 건수가 적어 무관하다.
 */
export function fetchFixtureRows(operation: string, cond?: Record<string, string>): Record<string, unknown>[] {
  const filename = OPERATION_FIXTURE_FILE[operation] ?? COMPETITION_OPERATION_FIXTURE_FILE[operation]
  if (!filename) return []

  const dir = OPERATION_FIXTURE_FILE[operation] ? FIXTURE_DIR : COMPETITION_FIXTURE_DIR
  let rows = readFixtureData(path.join(dir, filename))

  const extraFilename = DEV_EXTRA_FIXTURE_FILE[operation]
  if (extraFilename) {
    try {
      rows = [...rows, ...readFixtureData(path.join(DEV_FIXTURE_DIR, extraFilename))]
    } catch {
      // dev 추가 픽스처는 선택 사항이라 없어도 기본 10개로 동작한다.
    }
  }

  return applyCond(rows.map(shiftDatesDeep) as Record<string, unknown>[], cond)
}
