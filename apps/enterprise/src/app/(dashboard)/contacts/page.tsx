'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useRepositoryData } from '@/lib/hooks/use-repository-data';
import { filterByCompany } from '@/lib/tenant/filter';
import { fetchContacts } from '@/lib/repositories';
import { MOCK_CONTACTS } from '@/lib/mock-data';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { RouteGuard } from '@/components/auth/RouteGuard';

export default function ContactsPage() {
  const { effectiveCompanyId } = useAuth();
  const [query, setQuery] = useState('');
  const { data: contacts, loading } = useRepositoryData(
    `contacts-${effectiveCompanyId}`,
    () => fetchContacts(effectiveCompanyId),
    filterByCompany(MOCK_CONTACTS, effectiveCompanyId)
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.role_title.toLowerCase().includes(q) ||
        c.department_name?.toLowerCase().includes(q) ||
        c.responsibilities.some((r) => r.toLowerCase().includes(q))
    );
  }, [contacts, query]);

  return (
    <RouteGuard route="contacts">
      <div>
        <PageHeader
          title="担当者検索"
          description="部署・役割・責務から担当者を検索できます"
        />

        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-10"
            placeholder="名前、部署、役割で検索..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">担当者を読み込んでいます...</p>
        ) : filtered.length === 0 ? (
          <EmptyState title="担当者が見つかりません" />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((c) => (
              <Card key={c.id}>
                <CardBody>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">{c.full_name}</h3>
                      <p className="text-sm text-navy-700">{c.role_title}</p>
                      <p className="text-sm text-slate-500">{c.department_name}</p>
                    </div>
                    {c.is_primary && (
                      <span className="rounded bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-700">
                        主担当
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{c.email}</p>
                  {c.phone && <p className="text-sm text-slate-500">{c.phone}</p>}
                  <ul className="mt-3 list-inside list-disc text-sm text-slate-600">
                    {c.responsibilities.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
