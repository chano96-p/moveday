import { describe, expect, it } from 'vitest'
import { cleanAddressForGeocoding } from '@/lib/address'

describe('cleanAddressForGeocoding', () => {
  it('말미의 "일원"과 지구·블록 괄호를 함께 제거한다', () => {
    expect(cleanAddressForGeocoding('경기도 시흥시 하중동 일원 (시흥하중 공공주택지구 내 A-4블록)')).toBe(
      '경기도 시흥시 하중동',
    )
  })

  it('꼬리가 없으면 그대로 둔다', () => {
    expect(cleanAddressForGeocoding('경기도 화성시 동탄면')).toBe('경기도 화성시 동탄면')
  })

  it('괄호 없이 "일원"만 있어도 제거한다', () => {
    expect(cleanAddressForGeocoding('서울특별시 강남구 개포동 일원')).toBe('서울특별시 강남구 개포동')
  })

  it('말미가 아닌 괄호는 건드리지 않는다', () => {
    expect(cleanAddressForGeocoding('서울특별시 (임시) 강남구 개포동')).toBe('서울특별시 (임시) 강남구 개포동')
  })

  it('제거 후 빈 문자열이 되면 원문을 돌려준다', () => {
    expect(cleanAddressForGeocoding('(단지명만)')).toBe('(단지명만)')
  })

  it('말미 괄호가 여러 개 붙어도 전부 제거한다', () => {
    expect(cleanAddressForGeocoding('경기도 시흥시 하중동 (A블록) (임대)')).toBe('경기도 시흥시 하중동')
  })
})
