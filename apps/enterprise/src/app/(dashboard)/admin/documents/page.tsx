'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Upload, Trash2, FileText } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api/client';
import { encodeSessionHeader, SESSION_HEADER } from '@/lib/api/auth-guard';
import type { DocumentRecord, InformationClassification } from '@/types';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Input';
import { ClassificationBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/utils';
import { CLASSIFICATION_LABELS } from '@/lib/permissions';

const STATUS_LABELS: Record<DocumentRecord['status'], string> = {
  indexed: 'Indexed',
  processing: 'Processing',
  error: 'Error',
};

const STATUS_CLASS: Record<DocumentRecord['status'], string> = {
  indexed: 'bg-green-50 text-green-700',
  processing: 'bg-amber-50 text-amber-700',
  error: 'bg-red-50 text-red-700',
};

const FILE_TYPE_LABELS: Record<DocumentRecord['file_type'], string> = {
  pdf: 'PDF',
  docx: 'DOCX',
  xlsx: 'XLSX',
  pptx: 'PPTX',
  txt: 'TXT',
  md: 'MD',
};

interface DocumentStats {
  total: number;
  indexed: number;
  processing: number;
  error: number;
}

export default function AdminDocumentsPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [stats, setStats] = useState<DocumentStats>({ total: 0, indexed: 0, processing: 0, error: 0 });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [classification, setClassification] = useState<InformationClassification>('internal');
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await apiFetch(user, '/api/documents');
      const data = await res.json();
      if (data.documents) {
        setDocuments(data.documents);
        setStats(data.stats ?? { total: 0, indexed: 0, processing: 0, error: 0 });
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUpload = async () => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('title', title || file.name);
      form.append('department', department || user.department_name || '');
      if (user.department_id) form.append('department_id', user.department_id);
      form.append('classification', classification);

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { [SESSION_HEADER]: encodeSessionHeader(user) },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error?.message ?? 'アップロードに失敗しました');
        return;
      }
      setFile(null);
      setTitle('');
      await load();
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !confirm('このドキュメントを削除しますか？')) return;
    const res = await apiFetch(user, `/api/documents/${id}`, { method: 'DELETE' });
    if (res.ok) await load();
    else alert('削除に失敗しました');
  };

  return (
    <RouteGuard route="admin_documents">
      <div>
        <PageHeader
          title="ドキュメント管理"
          description="社内ファイルのアップロード・インデックス管理（RAG 基盤）"
        />

        <div className="mb-8 grid gap-4 sm:grid-cols-4">
          <Card>
            <CardBody>
              <p className="text-sm text-slate-500">ドキュメント件数</p>
              <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm text-slate-500">Indexed</p>
              <p className="text-3xl font-bold text-green-700">{stats.indexed}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm text-slate-500">Processing</p>
              <p className="text-3xl font-bold text-amber-600">{stats.processing}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm text-slate-500">Error</p>
              <p className="text-3xl font-bold text-red-600">{stats.error}</p>
            </CardBody>
          </Card>
        </div>

        <Card className="mb-6">
          <CardBody className="space-y-4">
            <h3 className="font-semibold text-slate-900">アップロード</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>ファイル（PDF / DOCX / XLSX / PPTX / TXT / MD）</Label>
                <Input
                  type="file"
                  accept=".pdf,.docx,.xlsx,.pptx,.txt,.md"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div>
                <Label>タイトル</Label>
                <Input
                  value={title}
                  placeholder="未入力時はファイル名"
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <Label>部署</Label>
                <Input
                  value={department}
                  placeholder={user?.department_name ?? '部署名'}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </div>
              <div>
                <Label>公開範囲</Label>
                <Select
                  value={classification}
                  onChange={(e) => setClassification(e.target.value as InformationClassification)}
                >
                  {Object.entries(CLASSIFICATION_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <Button onClick={() => void handleUpload()} disabled={!file || uploading}>
              <Upload className="h-4 w-4" />
              {uploading ? '処理中...' : 'アップロードしてインデックス'}
            </Button>
          </CardBody>
        </Card>

        {loading ? (
          <p className="text-sm text-slate-500">読み込み中...</p>
        ) : documents.length === 0 ? (
          <EmptyState title="ドキュメントがありません" description="ファイルをアップロードしてください" />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-6 py-3">タイトル</th>
                    <th className="px-6 py-3">種類</th>
                    <th className="px-6 py-3">部署</th>
                    <th className="px-6 py-3">担当者</th>
                    <th className="px-6 py-3">公開範囲</th>
                    <th className="px-6 py-3">状態</th>
                    <th className="px-6 py-3">更新日</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-6 py-3">
                        <Link
                          href={`/documents/${doc.id}`}
                          className="flex items-center gap-2 font-medium text-navy-800 hover:underline"
                        >
                          <FileText className="h-4 w-4 shrink-0" />
                          {doc.title}
                        </Link>
                        <p className="text-xs text-slate-400">{doc.filename}</p>
                      </td>
                      <td className="px-6 py-3">{FILE_TYPE_LABELS[doc.file_type]}</td>
                      <td className="px-6 py-3 text-slate-600">{doc.department ?? '—'}</td>
                      <td className="px-6 py-3 text-slate-600">{doc.owner_name ?? '—'}</td>
                      <td className="px-6 py-3">
                        <ClassificationBadge value={doc.classification} />
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[doc.status]}`}
                        >
                          {STATUS_LABELS[doc.status]}
                        </span>
                        {doc.error_message && (
                          <p className="mt-1 max-w-xs text-xs text-red-600">{doc.error_message}</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 text-slate-500">
                        {formatDate(doc.updated_at)}
                      </td>
                      <td className="px-6 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleDelete(doc.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </RouteGuard>
  );
}
