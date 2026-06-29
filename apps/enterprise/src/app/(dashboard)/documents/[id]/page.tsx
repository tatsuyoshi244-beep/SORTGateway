'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api/client';
import { canViewClassification } from '@/lib/permissions';
import type { DocumentChunk, DocumentRecord } from '@/types';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { ClassificationBadge } from '@/components/ui/Badge';
import { ConfidentialAccessBanner } from '@/components/security/ConfidentialAccessBanner';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import { ErrorState } from '@/components/ui/ErrorState';

export default function DocumentDetailPage({ params }: { params: { id: string } }) {
  const { user, activeTokenPass } = useAuth();
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch(user, `/api/documents/${params.id}`);
        const data = await res.json();
        if (!res.ok || !data.document) {
          setDocument(null);
          return;
        }
        setDocument(data.document);
        setChunks(data.chunks ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id, user]);

  useEffect(() => {
    if (!user || !document) return;
    const allowed = canViewClassification(
      user.role,
      document.classification,
      !!activeTokenPass,
      user.department_id,
      document.department_id
    );
    setDenied(!allowed);
  }, [user, document, activeTokenPass]);

  if (!user) return null;

  return (
    <RouteGuard route="document_detail">
      <div>
        <div className="mb-4">
          <Link href="/chat">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              チャットに戻る
            </Button>
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">読み込み中...</p>
        ) : !document ? (
          <ErrorState message="ドキュメントが見つかりません" />
        ) : denied ? (
          <ErrorState message="このドキュメントを閲覧する権限がありません" />
        ) : (
          <>
            <ConfidentialAccessBanner classification={document.classification} />
            <PageHeader
              title={document.title}
              description={document.filename}
            />

            <Card className="mb-6">
              <CardBody className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                <div>
                  <p className="text-xs text-slate-400">ファイル種類</p>
                  <p className="font-medium uppercase text-slate-800">{document.file_type}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">部署</p>
                  <p className="font-medium text-slate-800">{document.department ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">担当者</p>
                  <p className="font-medium text-slate-800">{document.owner_name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">更新日</p>
                  <p className="font-medium text-slate-800">{formatDate(document.updated_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">公開範囲</p>
                  <ClassificationBadge value={document.classification} prominent />
                </div>
                <div>
                  <p className="text-xs text-slate-400">状態</p>
                  <p className="font-medium capitalize text-slate-800">{document.status}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">チャンク数</p>
                  <p className="font-medium text-slate-800">{chunks.length}</p>
                </div>
              </CardBody>
            </Card>

            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <FileText className="h-4 w-4" />
              インデックス済みチャンク
            </h3>
            <div className="space-y-3">
              {chunks.map((chunk) => (
                <Card key={chunk.id}>
                  <CardBody>
                    <p className="mb-2 text-xs text-slate-400">
                      チャンク #{chunk.chunk_index + 1}
                      {chunk.page_number != null && ` · P${chunk.page_number}`}
                      {` · ${chunk.token_count} tokens · embedding: ${chunk.embedding_status}`}
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-slate-700">{chunk.content}</p>
                  </CardBody>
                </Card>
              ))}
              {chunks.length === 0 && (
                <p className="text-sm text-slate-500">インデックス済みチャンクがありません</p>
              )}
            </div>
          </>
        )}
      </div>
    </RouteGuard>
  );
}
