import { BaseIntegrationAdapter } from './base';
import type { AdapterSyncResult, ConnectionTestResult, IntegrationSource } from './base';

class GoogleDriveAdapter extends BaseIntegrationAdapter {
  readonly provider = 'google_drive' as const;

  async testConnection(): Promise<ConnectionTestResult> {
    return { ok: true, message: 'Google Drive API（モック）接続成功' };
  }

  async listSources(): Promise<IntegrationSource[]> {
    return this.mockSources('gdrive');
  }

  async sync(): Promise<AdapterSyncResult> {
    const items = this.mockSyncItems('Google Drive', 'gdrive');
    return {
      scanned_count: 3,
      imported_count: items.length,
      skipped_count: 1,
      error_count: 0,
      items,
      errors: [],
    };
  }
}

export const googleDriveAdapter = new GoogleDriveAdapter();
