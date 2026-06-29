import { BaseIntegrationAdapter } from './base';
import type { AdapterSyncResult, ConnectionTestResult, IntegrationSource } from './base';

class Microsoft365Adapter extends BaseIntegrationAdapter {
  readonly provider = 'microsoft_365' as const;

  async testConnection(): Promise<ConnectionTestResult> {
    return { ok: true, message: 'Microsoft Graph API（モック）接続成功' };
  }

  async listSources(): Promise<IntegrationSource[]> {
    return this.mockSources('m365');
  }

  async sync(): Promise<AdapterSyncResult> {
    const items = this.mockSyncItems('Microsoft 365', 'm365');
    return {
      scanned_count: 5,
      imported_count: items.length,
      skipped_count: 2,
      error_count: 0,
      items,
      errors: [],
    };
  }
}

export const microsoft365Adapter = new Microsoft365Adapter();
