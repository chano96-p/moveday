export abstract class AppError extends Error {
  abstract readonly code: string
  abstract readonly status: number
}

export class OdcloudKeyMissingError extends AppError {
  readonly code = 'ODCLOUD_KEY_MISSING'
  readonly status = 503
  constructor() {
    super('ODCLOUD_SERVICE_KEY가 설정되지 않았습니다.')
  }
}

export class RebstatKeyMissingError extends AppError {
  readonly code = 'REBSTAT_KEY_MISSING'
  readonly status = 503
  constructor() {
    super('REB_STAT_API_KEY가 설정되지 않았습니다.')
  }
}

export class RebstatTableUnknownError extends AppError {
  readonly code = 'REBSTAT_TABLE_UNKNOWN'
  readonly status = 503
  constructor() {
    super('통계표 코드가 아직 확정되지 않았습니다.')
  }
}

export class RebstatRegionUnmappedError extends AppError {
  readonly code = 'REBSTAT_REGION_UNMAPPED'
  readonly status = 503
  constructor() {
    super('해당 지역의 CLS_ID가 아직 매핑되지 않았습니다.')
  }
}

export class RebstatKeyInvalidError extends AppError {
  readonly code = 'REBSTAT_KEY_INVALID'
  readonly status = 502
  constructor() {
    super('R-ONE 인증키가 유효하지 않습니다.')
  }
}

export class RebstatSampleResponseError extends AppError {
  readonly code = 'REBSTAT_SAMPLE_RESPONSE'
  readonly status = 502
  constructor() {
    super('R-ONE이 샘플 응답을 반환했습니다.')
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

export function toErrorResponse(error: unknown): Response {
  if (isAppError(error)) {
    return Response.json({ error: error.code }, { status: error.status })
  }
  return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
}
