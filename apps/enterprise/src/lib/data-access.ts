import type { SessionUser, InformationClassification, KnowledgeItem, HandoverItem } from '@/types';
import {
  MOCK_HANDOVERS,
  MOCK_KNOWLEDGE,
} from '@/lib/mock-data';
import { canViewClassification } from '@/lib/permissions';

export function filterKnowledgeForUser(
  user: SessionUser,
  hasToken: boolean,
  items: KnowledgeItem[] = MOCK_KNOWLEDGE,
  options?: { publishedOnly?: boolean }
) {
  return items.filter((item) => {
    if (options?.publishedOnly && item.approval_status !== 'published') return false;
    return canViewClassification(
      user.role,
      item.classification,
      hasToken,
      user.department_id,
      item.department_id
    );
  });
}

export function filterHandoversForUser(
  user: SessionUser,
  hasToken: boolean,
  items: HandoverItem[] = MOCK_HANDOVERS
) {
  return items.filter((item) =>
    canViewClassification(
      user.role,
      item.classification,
      hasToken,
      user.department_id,
      item.department_id
    )
  );
}

export function classificationLabel(c: InformationClassification): string {
  const map = {
    internal: '社内一般',
    department: '部署限定',
    confidential: '機密',
    executive_only: '役員限定',
  };
  return map[c];
}
