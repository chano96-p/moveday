import type { Notice, NoticeType, SupplyRow } from '@/lib/types'
import { aptAdapter } from './apt'
import { remndrAdapter } from './remndr'
import { urbtyAdapter } from './urbty'
import { rentAdapter } from './rent'
import { optAdapter } from './opt'

export interface RegulationFlag {
  key: string
  label: string
}

export interface RegulationInfo {
  available: boolean
  flags: RegulationFlag[]
}

export interface NoticeCondFields {
  noticeNo: string
  houseManageNo: string
  noticeDate: string
}

export interface NoticeAdapter {
  detailOperation: string
  mdlOperation: string
  dateFormat: 'iso' | 'compact'
  areaKind: 'exclusive' | 'supply'
  // raw 필드명은 여기에만 존재한다(§4.3⑦) — 라우트·클라이언트는 이 값으로 cond를 조립한다.
  condFields: NoticeCondFields
  toNotice(raw: unknown): Notice
  toSupplyRows(raw: unknown[]): SupplyRow[]
  toRegulation(raw: unknown): RegulationInfo
}

export const ADAPTERS: Record<NoticeType, NoticeAdapter> = {
  APT: aptAdapter,
  REMNDR: remndrAdapter,
  URBTY_OFCTL: urbtyAdapter,
  PBL_PVT_RENT: rentAdapter,
  OPT: optAdapter,
}
