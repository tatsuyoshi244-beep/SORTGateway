'use client';

import Link from 'next/link';
import {
  ArrowRightLeft,
  BookOpen,
  MessageSquare,
  ScrollText,
  Users,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { filterHandoversForUser, filterKnowledgeForUser } from '@/lib/data-access';
import {
  MOCK_AUDIT_LOGS,
  MOCK_CONTACTS,
  MOCK_HANDOVERS,
  MOCK_KNOWLEDGE,
} from '@/lib/mock-data';
import { useRepositoryData } from '@/lib/hooks/use-repository-data';
import { canAccessRoute } from '@/lib/permissions';
import {
  fetchContacts,
  fetchHandoverItems,
  fetchKnowledgeItems,
} from '@/lib/repositories';
import { filterByCompany } from '@/lib/tenant/filter';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataLoadError } from '@/components/ui/DataLoadError';

export default function DashboardPage() {
  const { user, activeTokenPass, effectiveCompanyId } = useAuth();

  const { data: allKnowledge, error: knowledgeError, reload: reloadKnowledge } = useRepositoryData(
    `dashboard-knowledge-${effectiveCompanyId}`,
    () => fetchKnowledgeItems(effectiveCompanyId),
    filterByCompany(MOCK_KNOWLEDGE, effectiveCompanyId),
    { configuredInitial: [] }
  );
  const { data: allHandovers, error: handoverError, reload: reloadHandovers } = useRepositoryData(
    `dashboard-handovers-${effectiveCompanyId}`,
    () => fetchHandoverItems(effectiveCompanyId),
    filterByCompany(MOCK_HANDOVERS, effectiveCompanyId),
    { configuredInitial: [] }
  );
  const { data: contacts, error: contactsError, reload: reloadContacts } = useRepositoryData(
    `dashboard-contacts-${effectiveCompanyId}`,
    () => fetchContacts(effectiveCompanyId),
    filterByCompany(MOCK_CONTACTS, effectiveCompanyId),
    { configuredInitial: [] }
  );

  if (!user) return null;

  const knowledge = filterKnowledgeForUser(user, !!activeTokenPass, allKnowledge, {
    publishedOnly: true,
  });
  const handovers = filterHandoversForUser(user, !!activeTokenPass, allHandovers);
  const auditLogs = filterByCompany(MOCK_AUDIT_LOGS, effectiveCompanyId);
  const repositoryError = knowledgeError || handoverError || contactsError;

  const stats = [
    { label: '閲覧可能ナレッジ', value: knowledge.length, icon: BookOpen, href: '/knowledge' },
    { label: '引継ぎ情報', value: handovers.length, icon: ArrowRightLeft, href: '/handover' },
    { label: '担当者', value: contacts.length, icon: Users, href: '/contacts' },
  ];

  return (
    <div>
      <PageHeader
        title={`ようこそ、${user.full_name} さん`}
        description="社内ナレッジ・引継ぎ・担当者情報にすぐアクセスできます"
        action={
          <Link href="/chat">
            <Button>
              <MessageSquare className="h-4 w-4" />
              AIチャットを開く
            </Button>
          </Link>
        }
      />

      {repositoryError && (
        <DataLoadError
          message={repositoryError}
          onRetry={() => void Promise.all([reloadKnowledge(), reloadHandovers(), reloadContacts()])}
        />
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.label} href={s.href}>
              <Card className="transition-shadow hover:shadow-md">
                <CardBody className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                    <p className="text-sm text-slate-500">{s.label}</p>
                  </div>
                </CardBody>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardBody>
            <h3 className="font-semibold text-slate-900">クイックアクション</h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link href="/knowledge" className="text-navy-700 hover:underline">
                  ナレッジを検索する
                </Link>
              </li>
              <li>
                <Link href="/handover" className="text-navy-700 hover:underline">
                  引継ぎ情報を確認する
                </Link>
              </li>
              <li>
                <Link href="/contacts" className="text-navy-700 hover:underline">
                  担当者を探す
                </Link>
              </li>
            </ul>
          </CardBody>
        </Card>

        {canAccessRoute(user.role, 'admin_audit') && (
          <Card>
            <CardBody>
              <div className="flex items-center gap-2">
                <ScrollText className="h-4 w-4 text-slate-500" />
                <h3 className="font-semibold text-slate-900">最近の監査ログ</h3>
              </div>
              <ul className="mt-4 space-y-3">
                {auditLogs.slice(0, 3).map((log) => (
                  <li key={log.id} className="border-b border-slate-100 pb-2 text-sm last:border-0">
                    <p className="font-medium text-slate-800">{log.action}</p>
                    <p className="text-slate-500">{log.details}</p>
                  </li>
                ))}
              </ul>
              <Link href="/admin/audit" className="mt-4 inline-block text-sm text-navy-700 hover:underline">
                すべて見る →
              </Link>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
