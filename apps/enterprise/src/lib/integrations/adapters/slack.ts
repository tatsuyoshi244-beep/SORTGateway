import { BaseIntegrationAdapter } from './base';
import type { AdapterSyncResult, ConnectionTestResult, IntegrationSource } from './base';

class SlackAdapter extends BaseIntegrationAdapter {
  readonly provider = 'slack' as const;

  async testConnection(): Promise<ConnectionTestResult> {
    return { ok: true, message: 'Slack API（モック）接続成功' };
  }

  async listSources(): Promise<IntegrationSource[]> {
    return [
      { id: 'slack-1', name: '#general ピン留め', path: '/slack/general/pinned', mimeType: 'text/plain' },
      { id: 'slack-2', name: '#sales-playbook', path: '/slack/sales/playbook', mimeType: 'text/plain' },
    ];
  }

  async sync(): Promise<AdapterSyncResult> {
    const items = [
      {
        title: 'Slack #sales-playbook',
        filename: 'slack-sales-playbook.txt',
        content: '【Slack 同期】営業チャンネルのプレイブック抜粋。初回訪問・フォローアップ手順。',
        source_path: '/slack/sales/playbook',
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

export const slackAdapter = new SlackAdapter();
