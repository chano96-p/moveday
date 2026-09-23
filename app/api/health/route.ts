import { hasOdcloudKey } from '@/lib/applyhome/client'
import { isFixtureModeEnabled } from '@/lib/applyhome/fixtures'
import { REBSTAT_TABLES } from '@/lib/config'

export async function GET() {
  const odcloud = hasOdcloudKey()
  const rebstat = Boolean(process.env.REB_STAT_API_KEY)
  const kakaoMap = Boolean(process.env.NEXT_PUBLIC_KAKAO_MAP_KEY)

  return Response.json({
    ok: true,
    time: new Date().toISOString(),
    keys: { odcloud, rebstat, kakaoMap },
    // 키가 없어도 개발용 픽스처로 /api/notices가 동작 중인지 화면이 구분할 수 있게 한다.
    fixtures: isFixtureModeEnabled(),
    rebstatTables: {
      sale: REBSTAT_TABLES.apartmentSalePriceIndex !== null,
      jeonse: REBSTAT_TABLES.apartmentJeonsePriceIndex !== null,
      realTransaction: REBSTAT_TABLES.apartmentRealTransactionIndex !== null,
    },
  })
}
