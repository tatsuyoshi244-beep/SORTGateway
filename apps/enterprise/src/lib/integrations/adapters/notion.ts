import { BaseIntegrationAdapter } from './base';
import type { AdapterSyncResult, ConnectionTestResult, IntegrationSource } from './base';

class NotionAdapter extends BaseIntegrationAdapter {
  readonly provider = 'notion' as const;

  async testConnection(): Promise<ConnectionTestResult> {
    return { ok: true, message: 'Notion API（モック）接続成功' };
  }

  async listSources(): Promise<IntegrationSource[]> {
    return [
      { id: 'notion-1', name: '社内Wiki', path: '/notion/wiki', mimeType: 'text/markdown' },
      { id: 'notion-2', name: 'オンボーディング', path: '/notion/onboarding', mimeType: 'text/markdown' },
    ];
  }

  async sync(): Promise<AdapterSyncResult> {
    const items = [
      {
        title: 'Notion 社内Wiki',
        filename: 'notion-wiki.txt',
        content: '【Notion 同期】社内Wikiページのテキスト抽出。ツール利用ルール・連絡先一覧。',
        source_path: '/notion/wiki',
      },
    ];
    return {
      scanned_count: 2,
      imported_count: 1,
      skipped_count: 1,
      error_count: 0,
      items,
      errors: [],
    };
  }
}

export const notionAdapter = new NotionAdapter();
