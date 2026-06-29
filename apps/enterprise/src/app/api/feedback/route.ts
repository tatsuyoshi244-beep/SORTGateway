import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api/auth-guard';
import { addFeedback, listFeedback } from '@/lib/knowledge/lifecycle-store';
import { setChatLogFeedback } from '@/lib/analytics/chat-log-store';
import { requireManagerOrAbove } from '@/lib/api/auth-guard';
import type { FeedbackRating } from '@/types';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const denied = requireManagerOrAbove(auth);
  if (denied) return denied;

  const feedback = await listFeedback(auth.companyId);
  return NextResponse.json({ feedback });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const auth = await authenticateRequest(req, body);
  if (auth instanceof NextResponse) return auth;

  const rating = body.rating as FeedbackRating;
  if (rating !== 'positive' && rating !== 'negative') {
    return NextResponse.json({ error: { message: 'rating が不正です' } }, { status: 400 });
  }
  if (!body.question?.trim()) {
    return NextResponse.json({ error: { message: 'question が必要です' } }, { status: 400 });
  }

  const fb = await addFeedback({
    company_id: auth.companyId,
    user_id: auth.user.id,
    user_name: auth.user.full_name,
    question: String(body.question).slice(0, 500),
    answer_summary: String(body.answer_summary ?? '').slice(0, 500),
    rating,
    chat_message_id: body.chat_message_id ?? null,
  });

  if (body.chat_message_id) {
    await setChatLogFeedback(body.chat_message_id, rating);
  }

  return NextResponse.json({ feedback: fb });
}
