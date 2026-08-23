import { NextRequest, NextResponse } from 'next/server';
import { searchRagCandidates } from '@/lib/rag/search';
import { generateChatResponse } from '@/lib/chat/generate';
import { recordChatSend } from '@/lib/audit';
import { incrementChatUsage } from '@/lib/knowledge/lifecycle-store';
import { appendChatLog } from '@/lib/analytics/chat-log-store';
import { authenticateRequest } from '@/lib/api/auth-guard';
import { validateChatBody } from '@/lib/api/validate';
import { getClientIp, getUserAgent } from '@/lib/api/request-meta';
import { apiError, apiErrorFromException } from '@/lib/api/errors';
import { measureAsync } from '@/lib/observability/timing';

export const runtime = 'nodejs';

interface ChatRequestBody {
  message: string;
  hasActiveTokenPass?: boolean;
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

    const hasActiveTokenPass = Boolean(
      (body as ChatRequestBody & { hasActiveTokenPass?: boolean }).hasActiveTokenPass
    );

    const rag = await measureAsync('chat.rag', () =>
      searchRagCandidates(auth.user, validated.message!, hasActiveTokenPass)
    );
    const payload = await measureAsync('chat.generate', () =>
      generateChatResponse(validated.message!, rag)
    );

    const chatLog = await appendChatLog({
      company_id: auth.companyId,
      user: auth.user,
      question: validated.message!,
      payload,
    }}).catch(() => ({ id: 'demo-session' }));

    await incrementChatUsage().catch(() => 0);
    await recordChatSend(
      auth.user.id,
      auth.user.full_name,
      auth.companyId,
      validated.message!,
      payload.has_knowledge,
      getClientIp(req),
      getUserAgent(req)
    );

    return NextResponse.json({ payload, chat_log_id: chatLog.id });
  } catch (err) {
    return apiErrorFromException(err, 'chat.post');
  }
}
