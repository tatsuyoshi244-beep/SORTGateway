import type { IntegrationProvider } from '@/types';

export interface IntegrationSource {
  id: string;
  name: string;
  path: string;
  mimeType?: string;
}

export interface AdapterSyncResult {
  scanned_count: number;
  imported_count: number;
  skipped_count: number;
  error_count: number;
  items: Array<{
    title: string;
    filename: string;
    content: string;
    source_path: string;
  }>;
  errors: string[];
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
}

export interface IntegrationAdapter {
  readonly provider: IntegrationProvider;
  testConnection(
    config: Record<string, unknown>,
    credentials?: string
  ): Promise<ConnectionTestResult>;
  listSources(
    config: Record<string, unknown>,
    credentials?: string
  ): Promise<IntegrationSource[]>;
  sync(
    config: Record<string, unknown>,
    credentials?: string
  ): Promise<AdapterSyncResult>;
  disconnect(): Promise<void>;
}

export abstract class BaseIntegrationAdapter implements IntegrationAdapter {
  abstract readonly provider: IntegrationProvider;

  abstract testConnection(
    config: Record<string, unknown>,
    credentials?: string
  ): Promise<ConnectionTestResult>;

  abstract listSources(
    config: Record<string, unknown>,
    credentials?: string
  ): Promise<IntegrationSource[]>;

  abstract sync(
    config: Record<string, unknown>,
    credentials?: string
  ): Promise<AdapterSyncResult>;

  async disconnect(): Promise<void> {
    /* モック: 切断処理なし */
  }

  protected mockSources(prefix: string): IntegrationSource[] {
    return [
      { id: `${prefix}-1`, name: '就業規則.pdf', path: `/${prefix}/policies/就業規則.pdf`, mimeType: 'application/pdf' },
      { id: `${prefix}-2`, name: '営業マニュアル.docx', path: `/${prefix}/sales/営業マニュアル.docx`, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      { id: `${prefix}-3`, name: 'FAQ.md', path: `/${prefix}/faq/FAQ.md`, mimeType: 'text/markdown' },
    ];
  }

  protected mockSyncItems(providerLabel: string, prefix: string): AdapterSyncResult['items'] {
    return [
      {
        title: `${providerLabel} 就業規則`,
        filename: `${prefix}-就業規則.txt`,
        content: `【${providerLabel} 同期】就業規則の抜粋。勤務時間・休暇・服務規律について定めています。`,
        source_path: `/${prefix}/policies/就業規則.pdf`,
      },
      {
        title: `${providerLabel} 営業マニュアル`,
        filename: `${prefix}-営業マニュアル.txt`,
        content: `【${providerLabel} 同期】見積提出フロー、顧客訪問ルール、禁止事項を記載。`,
        source_path: `/${prefix}/sales/営業マニュアル.docx`,
      },
    ];
  }
}
