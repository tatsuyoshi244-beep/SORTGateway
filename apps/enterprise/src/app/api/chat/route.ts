import { NextRequest, NextResponse } from 'next/server';
import { searchRagCandidates } from '@/lib/rag/search';
import { buildAIUsageBlockedPayload, generateChatResponse } from '@/lib/chat/generate';
import { recordChatSend } from '@/lib/audit';
import { incrementChatUsage } from '@/lib/knowledge/lifecycle-store';
import { appendChatLog } from '@/lib/analytics/chat-log-store';
import { authenticateRequest } from '@/lib/api/auth-guard';
import { validateChatBody } from '@/lib/api/validate';
import { getClientIp, getUserAgent } from '@/lib/api/request-meta';
import { apiError, apiErrorFromException } from '@/lib/api/errors';
import { measureAsync } from '@/lib/observability/timing';
import { isOpenAIConfigured, isSupabaseConfigured } from '@/lib/env';
import { verifyTokenPassGrant } from '@/lib/token-pass/grant';
import { decideChatAnswerMode, type ChatHistoryTurn } from '@/lib/chat/policy';
import {
  finalizeAIUsage,
  getAIUsagePolicy,
  getAIUsageSummary,
  isAIUsagePersistenceReady,
  reserveGeneralAIUsage,
} from '@/lib/ai/policy-store';
import { evaluateAIUsagePolicy } from '@/lib/ai/policy';
import { applyAIOutputPolicy } from '@/lib/ai/output-filter';
import type { ChatAssistantPayload } from '@/types';

export const runtime = 'nodejs';

interface ChatRequestBody {
  message: string;
  tokenPassGrant?: string;
  history?: ChatHistoryTurn[];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const auth = await authenticateRequest(req, body);
    if (auth instanceof NextResponse) return auth;

    const validated = validateChatBody(body);
    if (!validated.ok) {
      return apiError('VALIDATION_ERROR', validated.message);
    }

    const hasActiveTokenPass = verifyTokenPassGrant(
      (body as ChatRequestBody).tokenPassGrant,
      auth.user.id,
      auth.companyId
    );

    const rag = await measureAsync('chat.rag', () =>
      searchRagCandidates(auth.user, validated.message!, hasActiveTokenPass)
    );
    const policy = await getAIUsagePolicy(auth.companyId);
    const answerMode = decideChatAnswerMode(validated.message!, rag);
    let reservationId: string | undefined;
    let payload: ChatAssistantPayload | undefined;

    if (answerMode === 'general') {
      const usage = await getAIUsageSummary(auth.companyId, auth.user.id);
      const decision = evaluateAIUsagePolicy(
        policy,
        usage,
        validated.message!.length,
        isAIUsagePersistenceReady()
      );
      if (!decision.allowed) {
        payload = buildAIUsageBlockedPayload(decision.reason);
      } else if (isOpenAIConfigured()) {
        const reservation = await reserveGeneralAIUsage({
          companyId: auth.companyId,
          userId: auth.user.id,
          inputChars: validated.message!.length,
        });
        if (!reservation.allowed) {
          payload = buildAIUsageBlockedPayload(reservation.reason ?? 'persistence_required');
        } else {
          reservationId = reservation.eventId;
        }
      }
    }

    if (!payload) {
      payload = await measureAsync('chat.generate', () =>
        generateChatResponse(validated.message!, rag, validated.history ?? [], {
          allowExternalInternalContext: policy.allow_internal_context,
        })
      );
    }
    payload = applyAIOutputPolicy(payload, policy);
    await finalizeAIUsage(reservationId, payload.answer.length).catch(() => undefined);

    let chatLog: { id: string };
    try {
      chatLog = await appendChatLog({
        company_id: auth.companyId,
        user: auth.user,
        question: validated.message!,
        payload,
      });
    } catch (error) {
      if (isSupabaseConfigured()) throw error;
      chatLog = { id: 'demo-session' };
    }

    await incrementChatUsage().catch(() => 0);
    await recordChatSend(
      auth.user.id,
      auth.user.full_name,
      auth.companyId,
      validated.message!,
      payload.has_knowledge,
      payload.answer_mode,
      getClientIp(req),
      getUserAgent(req)
    );

    return NextResponse.json({ payload, chat_log_id: chatLog.id });
  } catch (err) {
    return apiErrorFromException(err, 'chat.post');
  }
}
