import type { SessionUser } from '@/types';

/** 定期同期ジョブ用のシステムユーザー（監査・ドキュメント owner に使用） */
export function buildSystemSyncUser(companyId: string): SessionUser {
  return {
    id: 'system-scheduler',
    email: 'scheduler@sortgateway.local',
    full_name: '定期同期ジョブ',
    display_name: '定期同期ジョブ',
    role: 'admin',
    company_id: companyId,
    company_name: 'System',
    department_id: null,
  };
}
