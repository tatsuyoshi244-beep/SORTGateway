/** ナレッジ鮮度・検索順位ペナルティ */

export const FRESHNESS_THRESHOLDS = [30, 90, 180, 365] as const;
export type FreshnessTier = 30 | 90 | 180 | 365 | 'ok';

export function daysSince(isoDate: string): number {
  const then = new Date(isoDate).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

export function freshnessTier(updatedAt: string): FreshnessTier {
  const days = daysSince(updatedAt);
  if (days > 365) return 365;
  if (days > 180) return 180;
  if (days > 90) return 90;
  if (days > 30) return 30;
  return 'ok';
}

/** AI検索スコアへの乗数（古いほど低い） */
export function freshnessScoreMultiplier(updatedAt: string): number {
  const days = daysSince(updatedAt);
  if (days > 365) return 0.25;
  if (days > 180) return 0.45;
  if (days > 90) return 0.65;
  if (days > 30) return 0.85;
  return 1;
}

export function staleWarning(updatedAt: string): string | null {
  const days = daysSince(updatedAt);
  if (days > 365) return `参照ナレッジは更新から${days}日経過しています（1年以上）。内容の確認を推奨します。`;
  if (days > 180) return `参照ナレッジは更新から${days}日経過しています（180日超）。最新情報と照合してください。`;
  if (days > 90) return `参照ナレッジは更新から${days}日経過しています（90日超）。`;
  return null;
}

export function tierLabel(tier: FreshnessTier): string {
  if (tier === 'ok') return '30日以内';
  return `${tier}日超`;
}

export function tierClassName(tier: FreshnessTier): string {
  if (tier === 'ok') return 'text-green-700';
  if (tier === 30) return 'text-amber-600';
  if (tier === 90) return 'text-orange-600';
  return 'text-red-600 font-semibold';
}
