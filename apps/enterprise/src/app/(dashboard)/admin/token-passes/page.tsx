'use client';

import { useEffect, useState } from 'react';
import { KeyRound, Plus, ShieldCheck, UserCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useRepositoryData } from '@/lib/hooks/use-repository-data';
import {
  createTokenPass,
  fetchUsers,
  fetchTokenPasses,
  updateTokenPassActive,
} from '@/lib/repositories';
import { MOCK_TOKEN_PASSES, MOCK_USERS } from '@/lib/mock-data';
import { DEMO_TOKEN_PASS_CODE } from '@/lib/env';
import { filterByCompany } from '@/lib/tenant/filter';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Input';
import { ClassificationBadge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';
import { DataLoadError } from '@/components/ui/DataLoadError';
import { CLASSIFICATION_LABELS, ROLE_LABELS } from '@/lib/permissions';
import type { InformationClassification, UserRole } from '@/types';

const ISSUABLE_ROLES: UserRole[] = ['employee', 'manager', 'executive', 'admin'];
const ISSUABLE_SCOPES: InformationClassification[] = ['confidential', 'executive_only'];

export default function AdminTokenPassesPage() {
  const { user, effectiveCompanyId } = useAuth();
  const { data: passes, loading, source, error, reload, setData } = useRepositoryData(
    `token-passes-${effectiveCompanyId}`,
    () => fetchTokenPasses(effectiveCompanyId),
    filterByCompany(MOCK_TOKEN_PASSES, effectiveCompanyId),
    { persistMock: true, configuredInitial: [] }
  );
  const { data: users } = useRepositoryData(
    `token-pass-users-${effectiveCompanyId}`,
    () => fetchUsers(effectiveCompanyId),
    filterByCompany(MOCK_USERS, effectiveCompanyId),
    { configuredInitial: [] }
  );
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('Q2 機密レビュー用');
  const [expires, setExpires] = useState('');
  const [issuedTo, setIssuedTo] = useState('');
  const [allowedRoles, setAllowedRoles] = useState<UserRole[]>([
    'manager',
    'executive',
    'admin',
  ]);
  const [scopes, setScopes] = useState<InformationClassification[]>([
    'confidential',
    'executive_only',
  ]);
  const [maxUses, setMaxUses] = useState('50');
  const [issuedPlainCode, setIssuedPlainCode] = useState<string | null>(null);

  useEffect(() => {
    if (issuedTo || users.length === 0) return;
    const initial = source === 'mock'
      ? users.find((candidate) => candidate.id === 'user-3')
      : users.find((candidate) => candidate.is_active);
    setIssuedTo(initial?.id ?? '');
  }, [issuedTo, source, users]);

  const issue = async () => {
    if (!label.trim() || !expires || !issuedTo || scopes.length === 0 || allowedRoles.length === 0) {
      return;
    }

    const created = await createTokenPass({
      company_id: effectiveCompanyId,
      label,
      expires_at: new Date(expires).toISOString(),
      created_by: user?.id,
      issued_to: issuedTo,
      classification_scope: scopes,
      allowed_roles: allowedRoles,
      max_uses: maxUses ? Number(maxUses) : null,
    });

    if (created) {
      setData((prev) => [created, ...prev]);
      if (created.plain_code) {
        setIssuedPlainCode(created.plain_code);
      }
    }

    setLabel('');
    setExpires('');
    setShowForm(false);
  };

  const toggleRole = (role: UserRole) => {
    setAllowedRoles((current) =>
      current.includes(role) ? current.filter((value) => value !== role) : [...current, role]
    );
  };

  const toggleScope = (scope: InformationClassification) => {
    setScopes((current) =>
      current.includes(scope) ? current.filter((value) => value !== scope) : [...current, scope]
    );
  };

  const userName = (id: string | null) =>
    users.find((candidate) => candidate.id === id)?.full_name ?? id ?? '未指定';

  const toggle = async (id: string) => {
    const target = passes.find((p) => p.id === id);
    if (!target) return;

    if (source === 'supabase') {
      const ok = await updateTokenPassActive(id, !target.is_active);
      if (ok) {
        setData((prev) =>
          prev.map((p) => (p.id === id ? { ...p, is_active: !p.is_active } : p))
        );
      }
    } else {
      setData((prev) =>
        prev.map((p) => (p.id === id ? { ...p, is_active: !p.is_active } : p))
      );
    }
  };

  return (
    <RouteGuard route="admin_token_passes">
      <div>
        <PageHeader
          title="トークンパス管理"
          description={`${user?.company_name ?? '現在の企業'}専用。管理者が対象社員・閲覧範囲・期限・利用回数を指定して発行します`}
          action={
            <Button onClick={() => setShowForm(!showForm)}>
              <Plus className="h-4 w-4" />
              新規発行
            </Button>
          }
        />

        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <Card>
            <CardBody>
              <UserCheck className="h-5 w-5 text-navy-700" />
              <p className="mt-2 font-semibold text-slate-900">1. 対象社員を指定</p>
              <p className="mt-1 text-sm text-slate-500">この企業に所属する1人のアカウントへ発行します。</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <ShieldCheck className="h-5 w-5 text-navy-700" />
              <p className="mt-2 font-semibold text-slate-900">2. 条件を制限</p>
              <p className="mt-1 text-sm text-slate-500">対象情報・ロール・期限・利用回数を設定します。</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <KeyRound className="h-5 w-5 text-navy-700" />
              <p className="mt-2 font-semibold text-slate-900">3. 利用と監査</p>
              <p className="mt-1 text-sm text-slate-500">社員が利用理由を入力。利用結果は監査ログへ残ります。</p>
            </CardBody>
          </Card>
        </div>

        {source === 'mock' && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardBody>
              <p className="font-semibold text-blue-900">公開デモで確認する手順</p>
              <ol className="mt-2 space-y-1 text-sm text-blue-900">
                <li>1. この画面で「鈴木 一郎」向けの発行内容を確認</li>
                <li>2. ログアウトし、公開デモの「鈴木 一郎（EXE-001）」でログイン</li>
                <li>3. 画面上部の「トークンパス」を開き、「デモパスを入力」を押して適用</li>
                <li>4. AIチャットまたはナレッジ検索で機密情報の表示を確認</li>
              </ol>
              <div className="mt-3 rounded-lg border border-blue-200 bg-white px-3 py-2">
                <p className="text-xs text-slate-500">デモ確認用コード</p>
                <p className="font-mono font-semibold text-navy-900">{DEMO_TOKEN_PASS_CODE}</p>
              </div>
            </CardBody>
          </Card>
        )}

        {issuedPlainCode && (
          <Card className="mb-6 border-amber-300 bg-amber-50">
            <CardBody>
              <p className="font-semibold text-amber-900">発行したトークン（この画面を閉じると再表示できません）</p>
              <p className="mt-2 font-mono text-lg text-navy-900">{issuedPlainCode}</p>
              <Button className="mt-3" size="sm" variant="secondary" onClick={() => setIssuedPlainCode(null)}>
                確認しました
              </Button>
            </CardBody>
          </Card>
        )}

        {error && <DataLoadError message={error} onRetry={() => void reload()} />}

        {showForm && (
          <Card className="mb-6">
            <CardBody className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="token-label">発行理由・名称</Label>
                <Input id="token-label" value={label} onChange={(e) => setLabel(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="issued-to">対象社員</Label>
                <Select
                  id="issued-to"
                  value={issuedTo}
                  disabled={source === 'mock'}
                  onChange={(e) => setIssuedTo(e.target.value)}
                >
                  <option value="">選択してください</option>
                  {users.filter((candidate) => candidate.is_active).map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.full_name}（{candidate.employee_number}）
                    </option>
                  ))}
                </Select>
                {source === 'mock' && <p className="mt-1 text-xs text-blue-700">デモでは役員アカウントに固定されます</p>}
              </div>
              <div>
                <Label htmlFor="token-expiry">有効期限</Label>
                <Input
                  id="token-expiry"
                  type="datetime-local"
                  value={expires}
                  onChange={(e) => setExpires(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="max-uses">最大利用回数</Label>
                <Input
                  id="max-uses"
                  type="number"
                  min="1"
                  max="1000"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                />
              </div>
              <fieldset>
                <legend className="text-sm font-medium text-slate-700">対象情報</legend>
                <div className="mt-2 space-y-2">
                  {ISSUABLE_SCOPES.map((scope) => (
                    <label key={scope} className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={scopes.includes(scope)} onChange={() => toggleScope(scope)} />
                      {CLASSIFICATION_LABELS[scope]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-sm font-medium text-slate-700">利用可能ロール</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {ISSUABLE_ROLES.map((role) => (
                    <label key={role} className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={allowedRoles.includes(role)} onChange={() => toggleRole(role)} />
                      {ROLE_LABELS[role]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="flex items-end md:col-span-2">
                <Button onClick={() => void issue()}>発行</Button>
              </div>
            </CardBody>
          </Card>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">トークンパスを読み込んでいます...</p>
        ) : (
          <div className="space-y-3">
            {passes.map((p) => {
              const expired = new Date(p.expires_at) < new Date();
              return (
                <Card key={p.id}>
                  <CardBody className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-sm text-slate-500">token_hash 保存済み</p>
                      <p className="mt-1 font-medium text-slate-900">{p.label}</p>
                      <p className="mt-1 text-sm text-slate-600">対象社員: {userName(p.issued_to)}</p>
                      <p className="mt-2 text-sm text-slate-500">
                        期限: {formatDate(p.expires_at)}
                        {expired && <span className="ml-2 text-red-600">（期限切れ）</span>}
                        {p.revoked_at && <span className="ml-2 text-red-600">（失効）</span>}
                      </p>
                      <p className="text-sm text-slate-500">
                        利用: {p.used_count}
                        {p.max_uses !== null && ` / ${p.max_uses}`}
                        {p.last_used_at && ` · 最終利用 ${formatDate(p.last_used_at)}`}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {p.classification_scope.map((c) => (
                          <ClassificationBadge key={c} value={c} />
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        利用可能: {p.allowed_roles.map((role) => ROLE_LABELS[role]).join('、')}
                      </p>
                    </div>
                    <Button
                      variant={p.is_active ? 'secondary' : 'primary'}
                      size="sm"
                      onClick={() => void toggle(p.id)}
                    >
                      {p.is_active ? '無効化' : '有効化'}
                    </Button>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
