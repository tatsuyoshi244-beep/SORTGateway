import type {
  AppSettings,
  AuditLog,
  Department,
  FileConnection,
  HandoverItem,
  ResponsiblePerson,
  Role,
  TokenPass,
  User,
} from '@/types';
import { DEMO_COMPANY_ID, DEMO_COMPANY_NAME, PLATFORM_COMPANY_ID } from '@/lib/tenant/constants';
import { hashToken } from '@/lib/token-pass/hash';
import { MOCK_CHAT_LOGS } from '@/lib/analytics/mock-chat-logs';

export { MOCK_CHAT_LOGS };

const C = DEMO_COMPANY_ID;

export const MOCK_DEPARTMENTS: Department[] = [
  { id: 'dept-1', company_id: C, name: '営業部', code: 'SALES', created_at: '2024-01-01T00:00:00Z' },
  { id: 'dept-2', company_id: C, name: '開発部', code: 'DEV', created_at: '2024-01-01T00:00:00Z' },
  { id: 'dept-3', company_id: C, name: '経営企画', code: 'CORP', created_at: '2024-01-01T00:00:00Z' },
];

export const MOCK_ROLES: Role[] = [
  { id: 'role-1', name: 'employee', label: '一般社員', description: 'チャット・検索・閲覧' },
  { id: 'role-2', name: 'manager', label: '責任者', description: '部署ナレッジ・引継ぎ管理' },
  { id: 'role-3', name: 'executive', label: '役員', description: '機密・トークンパス利用' },
  { id: 'role-4', name: 'admin', label: '管理者', description: '自社全体管理' },
  { id: 'role-5', name: 'super_admin', label: 'SORT運営', description: '全テナント管理' },
];

export const MOCK_USERS: User[] = [
  {
    id: 'user-1',
    company_id: C,
    email: 'employee@sortgateway.local',
    full_name: '山田 太郎',
    role: 'employee',
    department_id: 'dept-1',
    department_name: '営業部',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-2',
    company_id: C,
    email: 'manager@sortgateway.local',
    full_name: '佐藤 花子',
    role: 'manager',
    department_id: 'dept-1',
    department_name: '営業部',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-3',
    company_id: C,
    email: 'executive@sortgateway.local',
    full_name: '鈴木 一郎',
    role: 'executive',
    department_id: 'dept-3',
    department_name: '経営企画',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-4',
    company_id: C,
    email: 'admin@sortgateway.local',
    full_name: '管理者 システム',
    role: 'admin',
    department_id: null,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-super',
    company_id: PLATFORM_COMPANY_ID,
    email: 'superadmin@sortgateway.local',
    full_name: 'SORT 運営管理者',
    role: 'super_admin',
    department_id: null,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
];

export const DEMO_PASSWORD = 'SortGateway2026!';

export { MOCK_KNOWLEDGE } from '@/lib/mock-lifecycle';

export const MOCK_HANDOVERS: HandoverItem[] = [
  {
    id: 'ho-1',
    company_id: C,
    title: 'A社案件 引継ぎ',
    content: '担当変更に伴う顧客背景、進行中タスク、未回収見積の状況。',
    from_person: '山田 太郎',
    to_person: '佐藤 花子',
    department_id: 'dept-1',
    department_name: '営業部',
    classification: 'department',
    status: 'published',
    due_date: '2026-06-15',
    updated_at: '2026-05-20T16:00:00Z',
  },
  {
    id: 'ho-2',
    company_id: C,
    title: '開発リリース手順 引継ぎ',
    content: '本番デプロイチェックリスト、ロールバック手順、連絡先。',
    from_person: '開発 リーダー',
    to_person: null,
    department_id: 'dept-2',
    department_name: '開発部',
    classification: 'internal',
    status: 'published',
    due_date: null,
    updated_at: '2026-04-10T12:00:00Z',
  },
];

export const MOCK_CONTACTS: ResponsiblePerson[] = [
  {
    id: 'rp-1',
    company_id: C,
    full_name: '佐藤 花子',
    email: 'manager@sortgateway.local',
    department_id: 'dept-1',
    department_name: '営業部',
    role_title: '営業部長',
    responsibilities: ['大型案件', '価格承認', '顧客エスカレーション'],
    phone: '03-0000-0001',
    is_primary: true,
  },
  {
    id: 'rp-2',
    company_id: C,
    full_name: '田中 健',
    email: 'tanaka@sortgateway.local',
    department_id: 'dept-2',
    department_name: '開発部',
    role_title: 'テックリード',
    responsibilities: ['アーキテクチャ', '本番障害対応'],
    phone: '03-0000-0002',
    is_primary: true,
  },
  {
    id: 'rp-3',
    company_id: C,
    full_name: '鈴木 一郎',
    email: 'executive@sortgateway.local',
    department_id: 'dept-3',
    department_name: '経営企画',
    role_title: '取締役',
    responsibilities: ['経営判断', 'コンプライアンス最終承認'],
    phone: null,
    is_primary: false,
  },
];

export const MOCK_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'al-1',
    company_id: C,
    user_id: 'user-4',
    user_name: '管理者 システム',
    action: 'role.change',
    resource_type: 'user',
    resource_id: 'user-1',
    result: 'success',
    details: 'ロール変更: employee → employee（確認）',
    ip_address: '127.0.0.1',
    user_agent: 'Mozilla/5.0 (demo)',
    created_at: '2026-06-02T09:00:00Z',
  },
  {
    id: 'al-2',
    company_id: C,
    user_id: 'user-3',
    user_name: '鈴木 一郎',
    action: 'token_pass.verify',
    resource_type: 'token_pass',
    resource_id: 'tp-1',
    result: 'success',
    details: 'トークン検証 成功',
    ip_address: '192.168.1.10',
    user_agent: 'Mozilla/5.0 (demo)',
    created_at: '2026-06-03T14:20:00Z',
  },
];

export const MOCK_TOKEN_PASSES: (TokenPass & { token_hash: string })[] = [
  {
    id: 'tp-1',
    company_id: C,
    token_hash: hashToken('EXEC-2026-Q2-A1B2'),
    label: 'Q2 機密レビュー用',
    classification_scope: ['confidential', 'executive_only'],
    allowed_roles: ['manager', 'executive', 'admin'],
    issued_to: '鈴木 一郎',
    created_by: 'user-4',
    expires_at: '2026-09-30T23:59:59Z',
    is_active: true,
    used_count: 3,
    max_uses: 50,
    revoked_at: null,
    last_used_at: '2026-06-03T14:20:00Z',
    created_at: '2026-04-01T00:00:00Z',
  },
  {
    id: 'tp-2',
    company_id: C,
    token_hash: hashToken('DEPT-SALES-TEMP'),
    label: '営業部 一時アクセス',
    classification_scope: ['department', 'confidential'],
    allowed_roles: ['employee', 'manager'],
    issued_to: null,
    created_by: 'user-4',
    expires_at: '2026-07-31T23:59:59Z',
    is_active: true,
    used_count: 0,
    max_uses: 10,
    revoked_at: null,
    last_used_at: null,
    created_at: '2026-05-01T00:00:00Z',
  },
];

export const MOCK_FILE_CONNECTIONS: FileConnection[] = [
  {
    id: 'fc-1',
    company_id: C,
    name: '営業部 SharePoint',
    provider: 'sharepoint',
    status: 'connected',
    sync_path: '/sites/sales/documents',
    last_synced_at: '2026-06-04T02:00:00Z',
    department_id: 'dept-1',
    created_at: '2025-12-01T00:00:00Z',
  },
  {
    id: 'fc-2',
    company_id: C,
    name: '全社 Google Drive',
    provider: 'google_drive',
    status: 'disconnected',
    sync_path: '/Shared/Company',
    last_synced_at: null,
    department_id: null,
    created_at: '2026-01-10T00:00:00Z',
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  company_name: DEMO_COMPANY_NAME,
  default_language: 'ja',
  chat_model: 'claude-sonnet-4-20250514',
  retention_days: 90,
  require_token_for_confidential: true,
};
