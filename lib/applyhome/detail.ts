import { ADAPTERS, type RegulationInfo } from '@/lib/applyhome/adapters'
import { APPLYHOME_DETAIL_BASE, fetchOdcloudAll } from '@/lib/applyhome/client'
import type { Notice, NoticeType, SupplyRow } from '@/lib/types'

export interface NoticeDetail {
  notice: Notice
  supply: SupplyRow[]
  regulation: RegulationInfo
  minPrice: number | null
  maxPrice: number | null
}

/**
 * Detail + Mdl을 조회해 상세 화면 한 벌을 만든다. 상세 라우트와 분석 라우트가 같은 입력을
 * 써야 하므로 라우트가 아니라 여기에 둔다 — 두 벌로 두면 한쪽만 고쳐져 **화면과 분석문이
 * 다른 숫자를 말하는** 상태가 조용히 생긴다.
 *
 * 공고가 없으면 `null`. 호출부가 404로 옮긴다.
 */
export async function fetchNoticeDetail(
  id: string,
  type: NoticeType,
  revalidate: number,
): Promise<NoticeDetail | null> {
  const adapter = ADAPTERS[type]

  // {id}는 PBLANC_NO다. Mdl 조회에 HOUSE_MANAGE_NO도 필요하므로 Detail을 먼저 조회한다.
  const detailRows = await fetchOdcloudAll<unknown>(APPLYHOME_DETAIL_BASE, adapter.detailOperation, {
    cond: { [`${adapter.condFields.noticeNo}::EQ`]: id },
    revalidate,
    perPage: 10,
  })

  if (detailRows.length === 0) return null

  const detailRaw = detailRows[0]
  const notice = adapter.toNotice(detailRaw)

  const mdlRows = await fetchOdcloudAll<unknown>(APPLYHOME_DETAIL_BASE, adapter.mdlOperation, {
    cond: {
      [`${adapter.condFields.houseManageNo}::EQ`]: notice.houseManageNo,
      [`${adapter.condFields.noticeNo}::EQ`]: notice.id,
    },
    revalidate,
    perPage: 100,
  })

  const supply = adapter.toSupplyRows(mdlRows)
  const prices = supply.map((row) => row.price).filter((v): v is number => v !== null)

  return {
    notice,
    supply,
    regulation: adapter.toRegulation(detailRaw),
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
  }
}
