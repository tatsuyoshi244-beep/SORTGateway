import type { AIUsagePolicy, ChatAssistantPayload } from '@/types';
import { containsSensitiveOutboundData } from '@/lib/chat/policy';

const OUTPUT_BLOCK_WARNING =
  '生成結果に機密情報・認証情報・個人情報の可能性がある内容を検出したため、表示を停止しました。';

export function applyAIOutputPolicy(
  payload: ChatAssistantPayload,
  policy: AIUsagePolicy
): ChatAssistantPayload {
  if (payload.answer_mode !== 'general') return payload;

  const inspectionTarget = [payload.answer, payload.rationale, ...payload.warnings].join('\n');
  if (containsSensitiveOutboundData(inspectionTarget)) {
    return {
      ...payload,
      answer: OUTPUT_BLOCK_WARNING,
      rationale: '外部AIの生成結果をSORT Gatewayの出力フィルターで遮断しました。',
      warnings: [OUTPUT_BLOCK_WARNING],
      answer_mode: 'restricted',
    };
  }

  const truncated = payload.answer.length > policy.max_output_chars;
  return {
    ...payload,
    answer: truncated
      ? `${payload.answer.slice(0, policy.max_output_chars - 1)}…`
      : payload.answer,
    warnings: truncated
      ? [...payload.warnings, `企業ポリシーにより回答を${policy.max_output_chars}文字で省略しました。`]
      : payload.warnings,
  };
}
