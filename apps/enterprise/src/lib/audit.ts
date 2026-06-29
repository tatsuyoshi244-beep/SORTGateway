import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAdminConfigured } from '@/lib/env';

export type AuditAction =
  | 'auth.login'
  | 'auth.logout'
  | 'chat.send'
  | 'knowledge.view'
  | 'token_pass.verify'
  | 'token_pass.apply'
  | 'document.upload'
  | 'document.delete'
  | 'tenant.switch'
  | 'role.change'
  | 'integration.connect'
  | 'integration.sync'
  | 'integration.disconnect'
  | 'admin.operation';

export type AuditResult = 'success' | 'failure';

export interface AuditRecordInput {
  userId: string;
  userName?: string;
  companyId: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string | null;
  result: AuditResult;
  details?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

function buildDetails(input: AuditRecordInput): string {
  const prefix = input.userName ? `[${input.userName}] ` : '';
  return `${prefix}${input.details ?? input.action}`;
}

/**
 * audit_logs へ記録（Supabase 未設定時は開発用コンソール出力のみ）
 */
export async function recordAuditLog(input: AuditRecordInput): Promise<void> {
  const payload = {
    company_id: input.companyId,
    user_id: input.userId,
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId ?? null,
    result: input.result,
    details: buildDetails(input),
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
    created_at: new Date().toISOString(),
  };

  if (!isSupabaseAdminConfigured()) {
    if (process.env.NODE_ENV === 'development') {
      console.info('[audit]', payload);
    }
    return;
  }

  const admin = createAdminClient();
  if (!admin) return;

  const { error } = await admin.from('audit_logs').insert(payload);
  if (error && process.env.NODE_ENV === 'development') {
    console.warn('[audit] insert failed:', error.message);
  }
}

export async function recordAuthLogin(
  userId: string,
  userName: string,
  companyId: string,
  success: boolean,
  ip?: string | null,
  userAgent?: string | null
) {
  await recordAuditLog({
    userId,
    userName,
    companyId,
    action: 'auth.login',
    resourceType: 'session',
    result: success ? 'success' : 'failure',
    details: success ? 'ログイン成功' : 'ログイン失敗',
    ipAddress: ip,
    userAgent,
  });
}

export async function recordAuthLogout(
  userId: string,
  userName: string,
  companyId: string,
  ip?: string | null,
  userAgent?: string | null
) {
  await recordAuditLog({
    userId,
    userName,
    companyId,
    action: 'auth.logout',
    resourceType: 'session',
    result: 'success',
    details: 'ログアウト',
    ipAddress: ip,
    userAgent,
  });
}

export async function recordTenantSwitch(
  userId: string,
  userName: string,
  companyId: string,
  targetCompanyId: string,
  targetCompanyName: string,
  ip?: string | null,
  userAgent?: string | null
) {
  await recordAuditLog({
    userId,
    userName,
    companyId,
    action: 'tenant.switch',
    resourceType: 'company',
    resourceId: targetCompanyId,
    result: 'success',
    details: `企業切替: ${targetCompanyName}`,
    ipAddress: ip,
    userAgent,
  });
}

export async function recordRoleChange(
  userId: string,
  userName: string,
  companyId: string,
  targetUserId: string,
  newRole: string,
  ip?: string | null,
  userAgent?: string | null
) {
  await recordAuditLog({
    userId,
    userName,
    companyId,
    action: 'role.change',
    resourceType: 'user',
    resourceId: targetUserId,
    result: 'success',
    details: `ロール変更: ${newRole}`,
    ipAddress: ip,
    userAgent,
  });
}

export async function recordChatSend(
  userId: string,
  userName: string,
  companyId: string,
  question: string,
  hasKnowledge: boolean,
  ip?: string | null,
  userAgent?: string | null
) {
  await recordAuditLog({
    userId,
    userName,
    companyId,
    action: 'chat.send',
    resourceType: 'chat',
    result: 'success',
    details: `質問送信（ナレッジ参照: ${hasKnowledge ? 'あり' : 'なし'}）: ${question.slice(0, 120)}`,
    ipAddress: ip,
    userAgent,
  });
}

export async function recordKnowledgeView(
  userId: string,
  userName: string,
  companyId: string,
  knowledgeId: string,
  title: string,
  ip?: string | null,
  userAgent?: string | null
) {
  await recordAuditLog({
    userId,
    userName,
    companyId,
    action: 'knowledge.view',
    resourceType: 'knowledge_item',
    resourceId: knowledgeId,
    result: 'success',
    details: `ナレッジ閲覧: ${title}`,
    ipAddress: ip,
    userAgent,
  });
}

export async function recordTokenPassVerify(
  userId: string,
  userName: string,
  companyId: string,
  passId: string | null,
  success: boolean,
  ip?: string | null,
  userAgent?: string | null
) {
  await recordAuditLog({
    userId,
    userName,
    companyId,
    action: 'token_pass.verify',
    resourceType: 'token_pass',
    resourceId: passId,
    result: success ? 'success' : 'failure',
    details: `トークン検証 ${success ? '成功' : '失敗'}`,
    ipAddress: ip,
    userAgent,
  });
}

export async function recordDocumentUpload(
  userId: string,
  userName: string,
  companyId: string,
  documentId: string,
  filename: string,
  ip?: string | null,
  userAgent?: string | null
) {
  await recordAuditLog({
    userId,
    userName,
    companyId,
    action: 'document.upload',
    resourceType: 'document',
    resourceId: documentId,
    result: 'success',
    details: `ドキュメントアップロード: ${filename}`,
    ipAddress: ip,
    userAgent,
  });
}

export async function recordDocumentDelete(
  userId: string,
  userName: string,
  companyId: string,
  documentId: string,
  filename: string,
  ip?: string | null,
  userAgent?: string | null
) {
  await recordAuditLog({
    userId,
    userName,
    companyId,
    action: 'document.delete',
    resourceType: 'document',
    resourceId: documentId,
    result: 'success',
    details: `ドキュメント削除: ${filename}`,
    ipAddress: ip,
    userAgent,
  });
}

export async function recordAdminOperation(
  userId: string,
  userName: string,
  companyId: string,
  operation: string,
  resourceType: string,
  resourceId?: string,
  ip?: string | null,
  userAgent?: string | null
) {
  await recordAuditLog({
    userId,
    userName,
    companyId,
    action: 'admin.operation',
    resourceType,
    resourceId,
    result: 'success',
    details: operation,
    ipAddress: ip,
    userAgent,
  });
}
