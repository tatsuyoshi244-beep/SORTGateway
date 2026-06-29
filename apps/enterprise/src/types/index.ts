/** SORT Gateway v2.1 Enterprise — 型定義 */

export type UserRole = 'employee' | 'manager' | 'executive' | 'admin' | 'super_admin';

export type CompanyPlan = 'starter' | 'standard' | 'enterprise';
export type CompanyStatus = 'active' | 'suspended' | 'trial';

export interface Company {
  id: string;
  name: string;
  slug: string;
  plan: CompanyPlan;
  status: CompanyStatus;
  created_at: string;
  updated_at: string;
  /** 集計（一覧 API で付与） */
  user_count?: number;
  document_count?: number;
  last_activity_at?: string | null;
}

export type InformationClassification =
  | 'internal'
  | 'department'
  | 'confidential'
  | 'executive_only';

export interface Role {
  id: string;
  name: UserRole;
  label: string;
  description: string;
}

export interface Department {
  id: string;
  company_id: string;
  name: string;
  code: string;
  created_at: string;
}

export interface User {
  id: string;
  company_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department_id: string | null;
  department_name?: string;
  is_active: boolean;
  created_at: string;
}

export type KnowledgeApprovalStatus = 'draft' | 'review' | 'approved' | 'published';

export interface KnowledgeItem {
  id: string;
  company_id: string;
  title: string;
  content: string;
  summary: string;
  category: string;
  classification: InformationClassification;
  department_id: string | null;
  department_name?: string;
  tags: string[];
  created_by: string;
  updated_at: string;
  approval_status: KnowledgeApprovalStatus;
  version: number;
  responsible_person_id: string | null;
  responsible_person_name?: string | null;
  updated_by: string | null;
  updated_by_name?: string | null;
  approved_by: string | null;
  approved_by_name?: string | null;
}

export interface KnowledgeVersion {
  id: string;
  knowledge_id: string;
  company_id: string;
  version: number;
  title: string;
  content: string;
  summary: string;
  updated_by: string | null;
  updated_by_name?: string | null;
  approved_by: string | null;
  approved_by_name?: string | null;
  approval_status: KnowledgeApprovalStatus;
  change_reason: string | null;
  created_at: string;
}

export type FeedbackRating = 'positive' | 'negative';

export interface KnowledgeFeedback {
  id: string;
  company_id: string;
  user_id: string;
  user_name: string;
  question: string;
  answer_summary: string;
  rating: FeedbackRating;
  chat_message_id: string | null;
  created_at: string;
}

export interface AppNotification {
  id: string;
  company_id: string;
  user_id: string | null;
  type:
    | 'knowledge_published'
    | 'knowledge_review'
    | 'system'
    | 'integration_sync_failed'
    | 'integration_sync_critical'
    | 'integration_sync_success';
  title: string;
  message: string;
  resource_type: string;
  resource_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface HandoverItem {
  id: string;
  company_id: string;
  title: string;
  content: string;
  from_person: string;
  to_person: string | null;
  department_id: string;
  department_name?: string;
  classification: InformationClassification;
  status: 'draft' | 'published' | 'archived';
  due_date: string | null;
  updated_at: string;
}

export interface ResponsiblePerson {
  id: string;
  company_id: string;
  full_name: string;
  email: string;
  department_id: string;
  department_name?: string;
  role_title: string;
  responsibilities: string[];
  phone: string | null;
  is_primary: boolean;
}

export interface KnowledgeSource {
  id: string;
  title: string;
  classification: InformationClassification;
  excerpt?: string;
  version?: number;
  updated_at?: string;
  responsible_department?: string | null;
  responsible_person?: string | null;
}

/** AI回答の品質・鮮度メタデータ */
export interface AnswerQualityInfo {
  confidence_score: number;
  knowledge_version: number | null;
  source_count: number;
  last_updated: string | null;
  responsible_department: string | null;
  responsible_person: string | null;
}

/** RAG: ドキュメントチャンク参照（チャット回答根拠） */
export interface DocumentReference {
  id: string;
  document_id: string;
  title: string;
  filename: string;
  page_number: number | null;
  department: string | null;
  classification: InformationClassification;
  updated_at: string;
  excerpt?: string;
}

export type DocumentFileType = 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'txt' | 'md';
export type DocumentStatus = 'processing' | 'indexed' | 'error';
export type EmbeddingStatus = 'pending' | 'completed' | 'error';

export interface DocumentRecord {
  id: string;
  company_id: string;
  title: string;
  filename: string;
  file_type: DocumentFileType;
  storage_path: string;
  department: string | null;
  department_id: string | null;
  classification: InformationClassification;
  owner_id: string | null;
  owner_name: string | null;
  status: DocumentStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentChunk {
  id: string;
  company_id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  page_number: number | null;
  embedding_status: EmbeddingStatus;
}

export interface DocumentChunkWithMeta extends DocumentChunk {
  document: Pick<
    DocumentRecord,
    'title' | 'filename' | 'department' | 'classification' | 'updated_at' | 'owner_name'
  >;
}

/** /api/chat レスポンス構造 */
export interface ChatAssistantPayload {
  answer: string;
  rationale: string;
  sources: KnowledgeSource[];
  references: KnowledgeSource[];
  document_references: DocumentReference[];
  warnings: string[];
  has_knowledge: boolean;
  quality: AnswerQualityInfo;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  payload?: ChatAssistantPayload;
  sources?: KnowledgeSource[];
  created_at: string;
}

export type FeedbackResult = 'positive' | 'negative' | null;

export type UnresolvedQuestionStatus = 'open' | 'assigned' | 'resolved' | 'hidden';

export interface ChatLog {
  id: string;
  company_id: string;
  user_id: string;
  user_name: string;
  department: string | null;
  department_id: string | null;
  question: string;
  answer_summary: string;
  has_knowledge: boolean;
  confidence_score: number;
  source_count: number;
  feedback_result: FeedbackResult;
  unresolved: boolean;
  resolved_by_admin: boolean;
  no_knowledge_reason: string | null;
  status: UnresolvedQuestionStatus;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
  knowledge_item_id: string | null;
  created_at: string;
}

export interface AnalyticsOverview {
  question_count: number;
  active_user_count: number;
  referenced_knowledge_count: number;
  with_knowledge_rate: number;
  without_knowledge_rate: number;
  feedback_count: number;
  negative_feedback_count: number;
  unresolved_count: number;
  stale_knowledge_reference_count: number;
}

export interface DepartmentAnalyticsRow {
  department_id: string | null;
  department: string;
  question_count: number;
  unresolved_count: number;
  negative_feedback_count: number;
  top_knowledge_titles: string[];
  stale_knowledge_count: number;
}

export interface UnresolvedQuestionView extends ChatLog {
  similar_count: number;
  group_keywords: string[];
}

export interface AuditLog {
  id: string;
  company_id: string;
  user_id: string;
  user_name?: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  result: 'success' | 'failure';
  details: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface TokenPass {
  id: string;
  company_id: string;
  label: string;
  classification_scope: InformationClassification[];
  allowed_roles: UserRole[];
  issued_to: string | null;
  created_by: string;
  expires_at: string;
  is_active: boolean;
  used_count: number;
  max_uses: number | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
  /** 作成直後のみ API が返す平文（以降は保存しない） */
  plain_code?: string;
}

export interface FileConnection {
  id: string;
  company_id: string;
  name: string;
  provider: 'sharepoint' | 'google_drive' | 'box' | 'local_smb';
  status: 'connected' | 'disconnected' | 'error';
  sync_path: string;
  last_synced_at: string | null;
  department_id: string | null;
  created_at: string;
}

export type IntegrationProvider =
  | 'google_drive'
  | 'microsoft_365'
  | 'slack'
  | 'teams'
  | 'notion'
  | 'box';

export type IntegrationConnectionStatus =
  | 'not_connected'
  | 'connected'
  | 'syncing'
  | 'error'
  | 'disabled';

export type IntegrationSyncFrequency = 'manual' | 'hourly' | 'daily' | 'weekly';

export interface IntegrationConnectionConfig {
  sync_target: string;
  enabled: boolean;
  /** 集計（最新同期から） */
  scanned_count?: number;
  imported_count?: number;
  error_count?: number;
}

/** API レスポンス用（credentials 非露出） */
export interface IntegrationConnection {
  id: string;
  company_id: string;
  provider: IntegrationProvider;
  status: IntegrationConnectionStatus;
  display_name: string;
  config_json: IntegrationConnectionConfig;
  has_credentials: boolean;
  last_sync_at: string | null;
  sync_enabled: boolean;
  sync_frequency: IntegrationSyncFrequency;
  next_sync_at: string | null;
  last_successful_sync_at: string | null;
  consecutive_error_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationSyncSummary {
  scheduled_enabled_count: number;
  error_connection_count: number;
  last_sync_at: string | null;
}

export type IntegrationSyncStatus = 'running' | 'success' | 'partial' | 'failed';
export type IntegrationSyncType = 'manual' | 'scheduled';

export interface IntegrationSyncLog {
  id: string;
  company_id: string;
  connection_id: string;
  provider: IntegrationProvider;
  sync_type: IntegrationSyncType;
  status: IntegrationSyncStatus;
  started_at: string;
  finished_at: string | null;
  scanned_count: number;
  imported_count: number;
  skipped_count: number;
  error_count: number;
  error_message: string | null;
}

export interface SessionUser {
  id: string;
  email: string;
  full_name: string;
  /** 表示名（public.users.full_name。将来 display_name カラム分離時もここにマップ） */
  display_name: string;
  role: UserRole;
  company_id: string;
  company_name: string;
  /** super_admin が操作中のテナント（企業切替） */
  tenant_company_id?: string | null;
  tenant_company_name?: string | null;
  department_id: string | null;
  department_name?: string;
  active_token_pass_id?: string | null;
}

export interface AppSettings {
  company_name: string;
  default_language: string;
  chat_model: string;
  retention_days: number;
  require_token_for_confidential: boolean;
}
