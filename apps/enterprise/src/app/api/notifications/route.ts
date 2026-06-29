import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api/auth-guard';
import { listNotifications } from '@/lib/knowledge/lifecycle-store';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const notifications = await listNotifications(auth.companyId, auth.user.id);
  const unread = notifications.filter((n) => !n.is_read).length;
  return NextResponse.json({ notifications, unread });
}
