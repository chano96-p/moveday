/**
 * 지오코딩 성공률을 높이기 위한 주소 전처리. `HSSPLY_ADRES` 원문에는 지오코더가 못 찾는
 * 꼬리가 붙는다 — "일원(부근)" 표기와 지구·블록을 부연하는 괄호(§9). 지번·도로명 자체는
 * 건드리지 않는다.
 */
export function cleanAddressForGeocoding(address: string): string {
  let withoutTrailingParens = address
  let previous: string
  // 말미 괄호가 여러 개 붙어 올 수 있다("... (A블록) (임대)") — 더 없어질 때까지 반복해서 벗긴다.
  do {
    previous = withoutTrailingParens
    withoutTrailingParens = withoutTrailingParens.replace(/\s*\([^)]*\)\s*$/, '').trim()
  } while (withoutTrailingParens !== previous)

  const withoutTrailingSuffix = withoutTrailingParens.replace(/\s*일원$/, '').trim()
  return withoutTrailingSuffix || address
}
