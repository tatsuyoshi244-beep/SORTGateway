import { cn } from '@/lib/utils';
import type { InformationClassification, UserRole } from '@/types';
import { CLASSIFICATION_LABELS, ROLE_LABELS } from '@/lib/permissions';

const classificationStyles: Record<InformationClassification, string> = {
  internal: 'bg-slate-100 text-slate-700',
  department: 'bg-blue-50 text-blue-700',
  confidential: 'bg-amber-50 text-amber-800',
  executive_only: 'bg-purple-50 text-purple-800',
};

const roleStyles: Record<UserRole, string> = {
  employee: 'bg-slate-100 text-slate-700',
  manager: 'bg-blue-50 text-blue-700',
  executive: 'bg-purple-50 text-purple-800',
  admin: 'bg-navy-50 text-navy-800',
  super_admin: 'bg-red-50 text-red-800',
};

export function ClassificationBadge({
  value,
  prominent,
}: {
  value: InformationClassification;
  prominent?: boolean;
}) {
  const isExecutive = value === 'executive_only';
  return (
    <span
      className={cn(
        'inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
        classificationStyles[value],
        (prominent || isExecutive) && isExecutive && 'ring-2 ring-purple-400 font-bold uppercase tracking-wide',
        (prominent || value === 'confidential') &&
          value === 'confidential' &&
          'ring-1 ring-amber-400 font-semibold'
      )}
    >
      {isExecutive ? `⚠ ${CLASSIFICATION_LABELS[value]}` : CLASSIFICATION_LABELS[value]}
    </span>
  );
}

export function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className={cn('inline-flex rounded-md px-2 py-0.5 text-xs font-medium', roleStyles[role])}>
      {ROLE_LABELS[role]}
    </span>
  );
}

export function StatusBadge({
  status,
  map,
}: {
  status: string;
  map: Record<string, { label: string; className: string }>;
}) {
  const cfg = map[status] ?? { label: status, className: 'bg-slate-100 text-slate-600' };
  return (
    <span className={cn('inline-flex rounded-md px-2 py-0.5 text-xs font-medium', cfg.className)}>
      {cfg.label}
    </span>
  );
}
