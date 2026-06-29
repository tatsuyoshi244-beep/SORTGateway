import type { DocumentChunk, DocumentRecord } from '@/types';
import { DEMO_COMPANY_ID } from '@/lib/tenant/constants';

const C = DEMO_COMPANY_ID;

export const MOCK_DOCUMENTS: DocumentRecord[] = [
  {
    id: 'doc-1',
    company_id: C,
    title: '就業規則',
    filename: '就業規則.pdf',
    file_type: 'pdf',
    storage_path: '.data/mock/就業規則.pdf',
    department: '人事部',
    department_id: 'dept-2',
    classification: 'internal',
    owner_id: 'user-2',
    owner_name: '佐藤 花子',
    status: 'indexed',
    error_message: null,
    created_at: '2026-01-10T09:00:00.000Z',
    updated_at: '2026-03-01T10:00:00.000Z',
  },
  {
    id: 'doc-2',
    company_id: C,
    title: '情報セキュリティポリシー',
    filename: 'セキュリティポリシー.docx',
    file_type: 'docx',
    storage_path: '.data/mock/セキュリティポリシー.docx',
    department: '情報システム部',
    department_id: 'dept-1',
    classification: 'confidential',
    owner_id: 'user-3',
    owner_name: '鈴木 一郎',
    status: 'indexed',
    error_message: null,
    created_at: '2026-02-01T09:00:00.000Z',
    updated_at: '2026-02-15T14:00:00.000Z',
  },
  {
    id: 'doc-3',
    company_id: C,
    title: '新入社員研修資料',
    filename: '研修資料.pptx',
    file_type: 'pptx',
    storage_path: '.data/mock/研修資料.pptx',
    department: '人事部',
    department_id: 'dept-2',
    classification: 'department',
    owner_id: 'user-2',
    owner_name: '佐藤 花子',
    status: 'error',
    error_message: 'PPTX 形式のテキスト抽出は未対応です',
    created_at: '2026-03-10T09:00:00.000Z',
    updated_at: '2026-03-10T09:05:00.000Z',
  },
];

export const MOCK_DOCUMENT_CHUNKS: DocumentChunk[] = [
  {
    id: 'chunk-1',
    company_id: C,
    document_id: 'doc-1',
    chunk_index: 0,
    content:
      '第12条（休暇）社員は年次有給休暇を所定の手続きにより取得できる。事前に上長の承認を得ること。就業規則に定める年次有給休暇の付与日数は入社6ヶ月経過後に10日付与される。',
    token_count: 60,
    page_number: 12,
    embedding_status: 'pending',
  },
  {
    id: 'chunk-2',
    company_id: C,
    document_id: 'doc-1',
    chunk_index: 1,
    content:
      '第5条（勤務時間）所定労働時間は1日8時間、週40時間とする。フレックスタイム制度を利用する場合は別途規程に従う。残業は36協定の範囲内で事前申請が必要。',
    token_count: 55,
    page_number: 5,
    embedding_status: 'pending',
  },
  {
    id: 'chunk-3',
    company_id: C,
    document_id: 'doc-2',
    chunk_index: 0,
    content:
      'パスワードは12文字以上とし、英大文字・小文字・数字・記号を含めること。90日ごとに変更を推奨する。多要素認証（MFA）は管理者アカウントおよびリモートアクセス時に必須とする。',
    token_count: 50,
    page_number: 3,
    embedding_status: 'pending',
  },
];
