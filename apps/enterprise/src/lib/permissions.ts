import type { InformationClassification, UserRole } from '@/types';
import { isSuperAdmin } from '@/lib/tenant/filter';

export type RouteKey =
  | 'dashboard'
  | 'chat'
  | 'knowledge'
  | 'handover'
  | 'contacts'
  | 'admin'
  | 'admin_knowledge'
  | 'admin_users'
  | 'admin_token_passes'
  | 'admin_audit'
  | 'admin_files'
  | 'admin_documents'
  | 'admin_companies'
  | 'admin_security'
  | 'admin_knowledge_health'
  | 'admin_feedback'
  | 'notifications'
  | 'admin_integrations'
  | 'admin_integrations_logs'
  | 'admin_analytics'
  | 'admin_analytics_departments'
  | 'admin_unresolved_questions'
  | 'admin_system'
  | 'document_detail'
  | 'settings';

export interface NavItem {
  key: RouteKey;
  href: string;
  label: string;
  icon: string;
  section: 'main' | 'management' | 'admin' | 'system';
}

const ALL_EMPLOYEE_ROLES: UserRole[] = [
  'employee',
  'manager',
  'executive',
  'admin',
  'super_admin',
];

const MANAGEMENT_ROLES: UserRole[] = ['manager', 'executive', 'admin', 'super_admin'];

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', href: '/dashboard', label: 'ダッシュボード', icon: 'LayoutDashboard', section: 'main' },
  { key: 'chat', href: '/chat', label: 'AIチャット', icon: 'MessageSquare', section: 'main' },
  { key: 'knowledge', href: '/knowledge', label: 'ナレッジ検索', icon: 'BookOpen', section: 'main' },
  { key: 'handover', href: '/handover', label: '引継ぎ情報', icon: 'ArrowRightLeft', section: 'main' },
  { key: 'contacts', href: '/contacts', label: '担当者検索', icon: 'Users', section: 'main' },
  { key: 'admin', href: '/admin', label: '管理者ダッシュボード', icon: 'Shield', section: 'admin' },
  { key: 'admin_knowledge', href: '/admin/knowledge', label: 'ナレッジ管理', icon: 'FileText', section: 'management' },
  { key: 'admin_knowledge_health', href: '/admin/knowledge-health', label: 'ナレッジ鮮度', icon: 'Activity', section: 'management' },
  { key: 'admin_documents', href: '/admin/documents', label: 'ドキュメント管理', icon: 'FileStack', section: 'management' },
  { key: 'admin_users', href: '/admin/users', label: 'ユーザー・ロール', icon: 'UserCog', section: 'admin' },
  { key: 'admin_token_passes', href: '/admin/token-passes', label: 'トークンパス', icon: 'KeyRound', section: 'admin' },
  { key: 'admin_audit', href: '/admin/audit', label: '監査ログ', icon: 'ScrollText', section: 'admin' },
  { key: 'admin_files', href: '/admin/files', label: 'ファイル連携', icon: 'FolderSync', section: 'admin' },
  { key: 'admin_companies', href: '/admin/companies', label: '企業管理', icon: 'Building2', section: 'admin' },
  { key: 'admin_security', href: '/admin/security', label: 'セキュリティ設定', icon: 'ShieldCheck', section: 'admin' },
  { key: 'admin_feedback', href: '/admin/feedback', label: 'AIフィードバック', icon: 'ThumbsUp', section: 'admin' },
  { key: 'admin_integrations', href: '/admin/integrations', label: '外部連携', icon: 'Plug', section: 'admin' },
  { key: 'admin_analytics', href: '/admin/analytics', label: '利用分析', icon: 'BarChart3', section: 'management' },
  { key: 'admin_unresolved_questions', href: '/admin/unresolved-questions', label: '未解決質問', icon: 'HelpCircle', section: 'management' },
  { key: 'admin_system', href: '/admin/system', label: 'システム状態', icon: 'Activity', section: 'admin' },
  { key: 'settings', href: '/settings', label: '設定', icon: 'Settings', section: 'system' },
  { key: 'notifications', href: '/notifications', label: '通知', icon: 'Bell', section: 'system' },
];

const ROUTE_ACCESS: Record<RouteKey, UserRole[]> = {
  dashboard: ALL_EMPLOYEE_ROLES,
  chat: ALL_EMPLOYEE_ROLES,
  knowledge: ALL_EMPLOYEE_ROLES,
  handover: ALL_EMPLOYEE_ROLES,
  contacts: ALL_EMPLOYEE_ROLES,
  admin: MANAGEMENT_ROLES,
  admin_knowledge: MANAGEMENT_ROLES,
  admin_knowledge_health: MANAGEMENT_ROLES,
  admin_users: ['admin', 'super_admin'],
  admin_token_passes: ['admin', 'super_admin'],
  admin_audit: ['manager', 'admin', 'super_admin'],
  admin_files: ['admin', 'super_admin'],
  admin_documents: MANAGEMENT_ROLES,
  admin_companies: ['super_admin'],
  admin_security: ['admin', 'super_admin'],
  admin_feedback: MANAGEMENT_ROLES,
  admin_integrations: ['admin', 'super_admin'],
  admin_integrations_logs: ['admin', 'super_admin'],
  admin_analytics: MANAGEMENT_ROLES,
  admin_analytics_departments: MANAGEMENT_ROLES,
  admin_unresolved_questions: MANAGEMENT_ROLES,
  admin_system: ['admin', 'super_admin'],
  document_detail: ALL_EMPLOYEE_ROLES,
  notifications: ALL_EMPLOYEE_ROLES,
  settings: ALL_EMPLOYEE_ROLES,
};

export function canAccessRoute(role: UserRole, key: RouteKey): boolean {
  return ROUTE_ACCESS[key]?.includes(role) ?? false;
}

export function getNavForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => canAccessRoute(role, item.key));
}

export function canViewClassification(
  role: UserRole,
  classification: InformationClassification,
  hasActiveTokenPass: boolean,
  userDepartmentId: string | null,
  itemDepartmentId: string | null
): boolean {
  const elevated = role === 'admin' || role === 'executive' || isSuperAdmin(role);

  switch (classification) {
    case 'internal':
      return true;
    case 'department':
      if (elevated) return true;
      return !!userDepartmentId && userDepartmentId === itemDepartmentId;
    case 'confidential':
      return elevated || role === 'manager' || hasActiveTokenPass;
    case 'executive_only':
      return role === 'executive' || role === 'admin' || isSuperAdmin(role);
    default:
      return false;
  }
}

export const ROLE_LABELS: Record<UserRole, string> = {
  employee: '一般社員',
  manager: '責任者',
  executive: '役員',
  admin: '管理者',
  super_admin: 'SORT運営',
};

export const CLASSIFICATION_LABELS: Record<InformationClassification, string> = {
  internal: '社内一般',
  department: '部署限定',
  confidential: '機密',
  executive_only: '役員限定',
};
