import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireManagerOrAbove } from '@/lib/api/auth-guard';
import { listKnowledge, saveKnowledge } from '@/lib/knowledge/lifecycle-store';
import { requireString } from '@/lib/api/validate';
import type { InformationClassification } from '@/types';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const items = await listKnowledge(auth.companyId);
  return NextResponse.json({ knowledge: items });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const auth = await authenticateRequest(req, body);
  if (auth instanceof NextResponse) return auth;

  const denied = requireManagerOrAbove(auth);
  if (denied) return denied;

  const title = requireString(body.title, 'title', { min: 1, max: 200 });
  const content = requireString(body.content, 'content', { min: 1 });
  if (!title.ok) return NextResponse.json({ error: { message: title.message } }, { status: 400 });
  if (!content.ok) return NextResponse.json({ error: { message: content.message } }, { status: 400 });

  const item = await saveKnowledge(
    {
      company_id: auth.companyId,
      title: title.value,
      content: content.value,
      summary: typeof body.summary === 'string' ? body.summary : '',
      category: typeof body.category === 'string' ? body.category : 'その他',
      classification: (body.classification as InformationClassification) ?? 'internal',
      department_id: body.department_id ?? auth.user.department_id,
      department_name: body.department_name ?? auth.user.department_name,
      responsible_person_id: body.responsible_person_id ?? auth.user.id,
      responsible_person_name: body.responsible_person_name ?? auth.user.full_name,
    },
    auth.user.id,
    auth.user.full_name
  );

  return NextResponse.json({ knowledge: item });
}
