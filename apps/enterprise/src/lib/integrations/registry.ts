import type { IntegrationProvider } from '@/types';
import type { IntegrationAdapter } from './adapters/base';
import { googleDriveAdapter } from './adapters/google-drive';
import { microsoft365Adapter } from './adapters/microsoft-365';
import { slackAdapter } from './adapters/slack';
import { teamsAdapter } from './adapters/teams';
import { notionAdapter } from './adapters/notion';
import { boxAdapter } from './adapters/box';

const ADAPTERS: Record<IntegrationProvider, IntegrationAdapter> = {
  google_drive: googleDriveAdapter,
  microsoft_365: microsoft365Adapter,
  slack: slackAdapter,
  teams: teamsAdapter,
  notion: notionAdapter,
  box: boxAdapter,
};

export function getIntegrationAdapter(provider: IntegrationProvider): IntegrationAdapter {
  const adapter = ADAPTERS[provider];
  if (!adapter) throw new Error(`未対応のプロバイダー: ${provider}`);
  return adapter;
}
