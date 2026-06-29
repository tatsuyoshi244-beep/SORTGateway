import { BaseIntegrationAdapter } from './base';
import type { AdapterSyncResult, ConnectionTestResult, IntegrationSource } from './base';

class BoxAdapter extends BaseIntegrationAdapter {
  readonly provider = 'box' as const;

  async testConnection(): Promise<ConnectionTestResult> {
    return { ok: true, message: 'Box API（モック）接続成功' };
  }

  async listSources(): Promise<IntegrationSource[]> {
    return this.mockSources('box');
  }

  async sync(): Promise<AdapterSyncResult> {
    const items = this.mockSyncItems('Box', 'box');
    return {
      scanned_count: 4,
      imported_count: items.length,
      skipped_count: 1,
      error_count: 0,
      items,
      errors: [],
    };
  }
}

export const boxAdapter = new BoxAdapter();
