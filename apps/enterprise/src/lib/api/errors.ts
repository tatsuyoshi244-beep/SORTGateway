import { NextResponse } from 'next/server';
import { logError } from '@/lib/observability/logger';

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: string;
  };
}

const USER_MESSAGES: Record<ApiErrorCode, string> = {
  UNAUTHORIZED: 'ログインが必要です。再度サインインしてください。',
  FORBIDDEN: 'この操作を行う権限がありません。',
  NOT_FOUND: '指定されたリソースが見つかりません。',
  VALIDATION_ERROR: '入力内容に誤りがあります。',
  INTERNAL_ERROR: '処理中にエラーが発生しました。しばらくしてから再度お試しください。',
  SERVICE_UNAVAILABLE: 'サービスが一時的に利用できません。',
};

const STATUS_MAP: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

export function apiError(
  code: ApiErrorCode,
  message?: string,
  details?: string
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    {
      error: {
        code,
        message: message ?? USER_MESSAGES[code],
        ...(details ? { details } : {}),
      },
    },
    { status: STATUS_MAP[code] }
  );
}

export function apiErrorFromException(
  err: unknown,
  context?: string
): NextResponse<ApiErrorBody> {
  const msg = err instanceof Error ? err.message : 'Unknown error';
  logError(context ?? 'api', err);
  return apiError('INTERNAL_ERROR', USER_MESSAGES.INTERNAL_ERROR, msg);
}
