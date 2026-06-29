'use client';

import { AlertTriangle, ShieldAlert } from 'lucide-react';
import type { InformationClassification } from '@/types';
import { SECURITY_POLICY } from '@/lib/security/config';

export function ConfidentialAccessBanner({
  classification,
}: {
  classification: InformationClassification;
}) {
  if (
    classification === 'confidential' &&
    SECURITY_POLICY.confidential_access.warn_on_confidential_view
  ) {
    return (
      <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p className="font-semibold">機密情報にアクセスしています</p>
          <p className="mt-1 text-amber-800">
            この操作は監査ログに記録されます。社外への持ち出し・転送は禁止されています。
          </p>
        </div>
      </div>
    );
  }

  if (
    classification === 'executive_only' &&
    SECURITY_POLICY.confidential_access.warn_on_executive_only
  ) {
    return (
      <div className="mb-4 flex items-start gap-3 rounded-lg border border-purple-300 bg-purple-50 px-4 py-3 text-sm text-purple-900">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-purple-600" />
        <div>
          <p className="font-semibold">役員限定情報 — 最高機密</p>
          <p className="mt-1 text-purple-800">
            役員・管理者のみが閲覧可能な情報です。アクセスは厳重に監査されます。
          </p>
        </div>
      </div>
    );
  }

  return null;
}
