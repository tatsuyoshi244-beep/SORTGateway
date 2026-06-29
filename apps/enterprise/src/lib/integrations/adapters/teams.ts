import { BaseIntegrationAdapter } from './base';
import type { AdapterSyncResult, ConnectionTestResult, IntegrationSource } from './base';

class TeamsAdapter extends BaseIntegrationAdapter {
  readonly provider = 'teams' as const;

  async testConnection(): Promise<ConnectionTestResult> {
    return { ok: true, message: 'Microsoft Teams API（モック）接続成功' };
  }

  async listSources(): Promise<IntegrationSource[]> {
    return [
      { id: 'teams-1', name: '全社チャネル Files', path: '/teams/company/files', mimeType: 'application/pdf' },
      { id: 'teams-2', name: '開発チーム Wiki', path: '/teams/dev/wiki', mimeType: 'text/html' },
    ];
  }

  async sync(): Promise<AdapterSyncResult> {
    const items = [
      {
        title: 'Teams 全社チャネル資料',
        filename: 'teams-company-handbook.txt',
        content: '【Teams 同期】全社チャネルに共有されたハンドブック抜粋。',
        source_path: '/teams/company/files',
      },
    ];
    return {
      scanned_count: 2,
      imported_count: 1,
      skipped_count: 0,
      error_count: 0,
      items,
      errors: [],
    };
  }
}

export const teamsAdapter = new TeamsAdapter();
