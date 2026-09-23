import { describe, expect, it } from 'vitest'
import { ADAPTERS } from '@/lib/applyhome/adapters'

import aptDetail from './fixtures/applyhome/apt-detail.json'
import aptMdl from './fixtures/applyhome/apt-mdl.json'
import remndrDetail from './fixtures/applyhome/remndr-detail.json'
import remndrMdl from './fixtures/applyhome/remndr-mdl.json'
import urbtyDetail from './fixtures/applyhome/urbty-detail.json'
import urbtyMdl from './fixtures/applyhome/urbty-mdl.json'
import rentDetail from './fixtures/applyhome/rent-detail.json'
import rentMdl from './fixtures/applyhome/rent-mdl.json'
import optDetail from './fixtures/applyhome/opt-detail.json'
import optMdl from './fixtures/applyhome/opt-mdl.json'

describe('APT 어댑터', () => {
  it('Detail을 Notice로 매핑하고, null인 윈도우는 걸러낸다', () => {
    const notice = ADAPTERS.APT.toNotice(aptDetail.data[0])
    expect(notice.type).toBe('APT')
    expect(notice.id).toBe('2026820011')
    expect(notice.houseManageNo).toBe('2026820011')
    expect(notice.region).toBe('경기')
    expect(notice.noticeDate).toBe('2026-09-18')
    // all + 1순위 해당지역 + 1순위 기타지역 + 2순위 해당지역 + 2순위 기타지역 = 5개 (특별공급 · 기타경기는 null)
    expect(notice.receipt).toHaveLength(5)
    expect(notice.receiptStart).toBe('2026-09-28')
    expect(notice.receiptEnd).toBe('2026-09-29')
  })

  it('Mdl을 SupplyRow로 매핑하고 공급면적 기준이다', () => {
    const rows = ADAPTERS.APT.toSupplyRows(aptMdl.data)
    expect(rows).toHaveLength(2)
    expect(rows[0].area.kind).toBe('supply')
    expect(rows[0].price).toBe(36707)
    expect(rows[1].price).toBe(39358) // "39,358" 쉼표 제거
    expect(ADAPTERS.APT.areaKind).toBe('supply')
  })
})

describe('REMNDR 어댑터', () => {
  it('Detail을 Notice로 매핑한다 (전체+일반 2개 윈도우, 날짜가 같아도 둘 다 남는다)', () => {
    const notice = ADAPTERS.REMNDR.toNotice(remndrDetail.data[0])
    expect(notice.type).toBe('REMNDR')
    expect(notice.houseSecd).toBe('06')
    // §9 — all과 general이 실제로 같은 날짜로 온다(Phase 8 실측). 어댑터는 그대로 둘 다 담고,
    // "all은 폴백일 때만 렌더"는 화면(ScheduleTimeline) 몫이다.
    expect(notice.receipt).toHaveLength(2)
  })

  it('Mdl을 SupplyRow로 매핑한다', () => {
    const rows = ADAPTERS.REMNDR.toSupplyRows(remndrMdl.data)
    expect(rows).toHaveLength(1)
    expect(rows[0].houseType).toBe('084.9811C')
    expect(rows[0].price).toBe(122202)
  })
})

describe('URBTY_OFCTL 어댑터', () => {
  it('Detail을 Notice로 매핑한다 (전체 1개 윈도우)', () => {
    const notice = ADAPTERS.URBTY_OFCTL.toNotice(urbtyDetail.data[0])
    expect(notice.type).toBe('URBTY_OFCTL')
    expect(notice.receipt).toHaveLength(1)
    expect(notice.receipt[0].kind).toBe('all')
  })

  it('Mdl은 전용면적 기준이고, GP가 "-"면 houseType에서 걸러낸다', () => {
    const rows = ADAPTERS.URBTY_OFCTL.toSupplyRows(urbtyMdl.data)
    expect(rows).toHaveLength(2)
    expect(rows[0].area.kind).toBe('exclusive')
    expect(rows[1].price).toBe(49074)
    // GP가 "-"(값 없음)라 TP만 남아야 한다 — "- 84OA"처럼 자리표시자가 새면 안 된다(버그 회귀).
    expect(rows[1].houseType).toBe('84OA')
    expect(ADAPTERS.URBTY_OFCTL.areaKind).toBe('exclusive')
  })
})

describe('PBL_PVT_RENT 어댑터', () => {
  it('YYYYMMDD 날짜를 ISO로 정규화한다', () => {
    const notice = ADAPTERS.PBL_PVT_RENT.toNotice(rentDetail.data[0])
    expect(notice.type).toBe('PBL_PVT_RENT')
    expect(notice.noticeDate).toBe('2026-09-21')
    expect(notice.receipt).toHaveLength(1)
    expect(notice.receiptStart).toBe('2026-09-28')
  })

  it('Mdl은 전용면적을 우선 쓰고, GP가 "-"면 houseType에서 걸러낸다', () => {
    const rows = ADAPTERS.PBL_PVT_RENT.toSupplyRows(rentMdl.data)
    expect(rows[0].area.kind).toBe('exclusive')
    expect(rows[0].area.value).toBe(59.8947)
    // GP가 100% "-"로 오는 유형이다(Phase 8 실측) — "- 59A-1"처럼 새면 안 된다(버그 회귀).
    expect(rows[0].houseType).toBe('59A-1')
  })
})

describe('OPT 어댑터', () => {
  it('YYYYMMDD 날짜를 ISO로 정규화한다 (전체 1개 윈도우, 특별공급·일반은 null)', () => {
    const notice = ADAPTERS.OPT.toNotice(optDetail.data[0])
    expect(notice.type).toBe('OPT')
    expect(notice.noticeDate).toBe('2026-09-21')
    expect(notice.receipt).toHaveLength(1)
    expect(notice.receipt[0].kind).toBe('all')
  })

  it('Mdl에는 면적 필드가 없고, HOUSE_TY 말미 공백은 조인 키에서 트리밍된다', () => {
    const rows = ADAPTERS.OPT.toSupplyRows(optMdl.data)
    expect(rows[0].area.value).toBeNull()
    expect(rows[0].price).toBe(36800) // "36,800" 쉼표 제거(Phase 8 실측)
    // 실측 HOUSE_TY 중 하나가 말미 공백을 달고 온다("074.9976 ") — 조인 키는 트리밍해야 한다.
    const trailingSpaceRow = rows.find((r) => r.houseType.trim() === '074.9976')
    expect(trailingSpaceRow?.houseTypeKey).toBe('074.9976')
  })
})
