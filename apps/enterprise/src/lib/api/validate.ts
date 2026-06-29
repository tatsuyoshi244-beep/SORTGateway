import type { CompanyPlan, CompanyStatus, InformationClassification, UserRole } from '@/types';

export interface ValidationResult {
  ok: true;
}

export interface ValidationError {
  ok: false;
  message: string;
}

export type ValidateResult = ValidationResult | ValidationError;

const USER_ROLES: UserRole[] = ['employee', 'manager', 'executive', 'admin', 'super_admin'];
const CLASSIFICATIONS: InformationClassification[] = [
  'internal',
  'department',
  'confidential',
  'executive_only',
];
const COMPANY_PLANS: CompanyPlan[] = ['starter', 'standard', 'enterprise'];
const COMPANY_STATUSES: CompanyStatus[] = ['active', 'suspended', 'trial'];

export function fail(message: string): ValidationError {
  return { ok: false, message };
}

export function requireString(
  value: unknown,
  field: string,
  opts?: { min?: number; max?: number }
): ValidateResult & { value?: string } {
  if (typeof value !== 'string' || !value.trim()) {
    return fail(`${field} が必要です`);
  }
  const trimmed = value.trim();
  if (opts?.min != null && trimmed.length < opts.min) {
    return fail(`${field} は ${opts.min} 文字以上です`);
  }
  if (opts?.max != null && trimmed.length > opts.max) {
    return fail(`${field} は ${opts.max} 文字以内です`);
  }
  return { ok: true, value: trimmed };
}

export function requireEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[]
): ValidateResult & { value?: T } {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    return fail(`${field} が不正です`);
  }
  return { ok: true, value: value as T };
}

export function validateChatBody(body: unknown): ValidateResult & { message?: string } {
  if (!body || typeof body !== 'object') return fail('リクエストボディが不正です');
  const b = body as Record<string, unknown>;
  const msg = requireString(b.message, 'message', { min: 1, max: 4000 });
  if (!msg.ok) return msg;
  return { ok: true, message: msg.value };
}

export function validateTokenVerifyBody(body: unknown): ValidateResult & { code?: string } {
  if (!body || typeof body !== 'object') return fail('リクエストボディが不正です');
  const b = body as Record<string, unknown>;
  const code = requireString(b.code, 'code', { min: 4, max: 64 });
  if (!code.ok) return code;
  return { ok: true, code: code.value };
}

export function validateCompanyCreateBody(body: unknown): ValidateResult & {
  name?: string;
  slug?: string;
  plan?: CompanyPlan;
} {
  if (!body || typeof body !== 'object') return fail('リクエストボディが不正です');
  const b = body as Record<string, unknown>;
  const name = requireString(b.name, 'name', { min: 1, max: 120 });
  if (!name.ok) return name;
  const slug = requireString(b.slug, 'slug', { min: 2, max: 64 });
  if (!slug.ok) return slug;
  if (!/^[a-z0-9-]+$/.test(slug.value!)) {
    return fail('slug は小文字英数字とハイフンのみです');
  }
  let plan: CompanyPlan | undefined;
  if (b.plan != null) {
    const p = requireEnum(b.plan, 'plan', COMPANY_PLANS);
    if (!p.ok) return p;
    plan = p.value;
  }
  return { ok: true, name: name.value, slug: slug.value, plan };
}

export function validateCompanyPatchBody(body: unknown): ValidateResult & {
  id?: string;
  status?: CompanyStatus;
} {
  if (!body || typeof body !== 'object') return fail('リクエストボディが不正です');
  const b = body as Record<string, unknown>;
  const id = requireString(b.id, 'id', { min: 1, max: 64 });
  if (!id.ok) return id;
  const status = requireEnum(b.status, 'status', COMPANY_STATUSES);
  if (!status.ok) return status;
  return { ok: true, id: id.value, status: status.value };
}

export function validateClassification(value: unknown): InformationClassification {
  if (typeof value === 'string' && CLASSIFICATIONS.includes(value as InformationClassification)) {
    return value as InformationClassification;
  }
  return 'internal';
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && USER_ROLES.includes(value as UserRole);
}

const MIME_BY_EXT: Record<string, string[]> = {
  pdf: ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  txt: ['text/plain'],
  md: ['text/markdown', 'text/plain', 'text/x-markdown'],
};

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export function validateUploadFile(
  file: File,
  fileType: string
): ValidateResult {
  if (file.size <= 0) return fail('空のファイルはアップロードできません');
  if (file.size > MAX_UPLOAD_BYTES) {
    return fail(`ファイルサイズは ${MAX_UPLOAD_BYTES / 1024 / 1024}MB 以下にしてください`);
  }
  const allowedMimes = MIME_BY_EXT[fileType];
  if (allowedMimes && file.type && !allowedMimes.includes(file.type)) {
    return fail(`MIME タイプ (${file.type}) が拡張子と一致しません`);
  }
  return { ok: true };
}
