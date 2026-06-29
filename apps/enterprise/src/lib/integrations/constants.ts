import type { IntegrationProvider } from '@/types';

export const INTEGRATION_PROVIDER_LABELS: Record<IntegrationProvider, string> = {
  google_drive: 'Google Drive',
  microsoft_365: 'Microsoft 365 / OneDrive / SharePoint',
  slack: 'Slack',
  teams: 'Microsoft Teams',
  notion: 'Notion',
  box: 'Box',
};

export const INTEGRATION_PROVIDER_DESCRIPTIONS: Record<IntegrationProvider, string> = {
  google_drive: 'Google Workspace のドライブからドキュメントを同期',
  microsoft_365: 'SharePoint / OneDrive から社内ファイルを取り込み',
  slack: 'チャンネル添付ファイル・ナレッジベース連携',
  teams: 'Teams チャネルファイルの同期',
  notion: 'Notion ページをドキュメントとしてインデックス',
  box: 'Box エンタープライズストレージ連携',
};

export const ALL_INTEGRATION_PROVIDERS: IntegrationProvider[] = [
  'google_drive',
  'microsoft_365',
  'slack',
  'teams',
  'notion',
  'box',
];
