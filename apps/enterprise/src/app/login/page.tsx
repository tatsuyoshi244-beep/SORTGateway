'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { allowsDemoAuth } from '@/lib/env';
import { DEMO_PASSWORD, MOCK_USERS } from '@/lib/mock-data';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';

export default function LoginPage() {
  const { user, login, isLoading, isSupabaseAuth } = useAuth();
  const router = useRouter();
  const [companyId, setCompanyId] = useState('');
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const demoMode = allowsDemoAuth();

  useEffect(() => {
    if (!isLoading && user) router.replace('/dashboard');
  }, [user, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const result = await login(companyId, employeeNumber, password);
    setSubmitting(false);
    if (result.ok) {
      router.push('/dashboard');
    } else {
      setError(result.error ?? 'ログインに失敗しました');
    }
  };

  const fillDemoCredentials = (demoUserId: string) => {
    const demoUser = MOCK_USERS.find((candidate) => candidate.id === demoUserId);
    if (!demoUser) return;
    setError('');
    setCompanyId(demoUser.company_id);
    setEmployeeNumber(demoUser.employee_number);
    setPassword(DEMO_PASSWORD);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-navy-900 p-12 text-white lg:flex">
        <div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-sm font-bold">
            SG
          </div>
          <h1 className="mt-8 text-3xl font-bold leading-tight">
            SORT Gateway
            <br />
            <span className="text-navy-100">v2.1 Enterprise</span>
          </h1>
          <p className="mt-4 max-w-md text-navy-100 leading-relaxed">
            社内情報・引継ぎ・担当者・FAQ・業務ルールを、
            社員がログインするだけで安全に確認できるナレッジゲートウェイです。
          </p>
        </div>
        <ul className="space-y-3 text-sm text-navy-100">
          <li>· ロール別アクセス制御（社員 / 責任者 / 役員 / 管理者）</li>
          <li>· 情報分類（社内一般 / 部署限定 / 機密 / 役員限定）</li>
          <li>· 監査ログ・トークンパス・ファイル連携</li>
        </ul>
      </div>

      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <p className="text-xl font-bold text-navy-900">SORT Gateway v2.1</p>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">ログイン</h2>
          <p className="mt-2 text-sm text-slate-500">
            {isSupabaseAuth
              ? '企業ID・社員番号・パスワードを入力してください'
              : demoMode
                ? 'デモ用の企業ID・社員番号・パスワードでログインできます'
                : '企業ID・社員番号・パスワードを入力してください'}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <Label htmlFor="companyId">企業ID</Label>
              <Input
                id="companyId"
                autoComplete="organization"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                placeholder="例: demo-company"
                required
              />
            </div>
            <div>
              <Label htmlFor="employeeNumber">社員番号</Label>
              <Input
                id="employeeNumber"
                autoComplete="username"
                value={employeeNumber}
                onChange={(e) => setEmployeeNumber(e.target.value)}
                placeholder="例: EMP-001"
                required
              />
            </div>
            <div>
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              {submitting ? 'ログイン中...' : 'ログイン'}
            </Button>
          </form>

          {demoMode && (
            <div className="mt-8 border-t border-slate-200 pt-6">
              <div className="mb-4 flex items-center gap-2">
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  公開デモ
                </span>
                <p className="text-xs text-slate-500">役割を選ぶとデモ情報を入力します</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {MOCK_USERS.map((demoUser) => (
                  <button
                    key={demoUser.id}
                    type="button"
                    onClick={() => fillDemoCredentials(demoUser.id)}
                    disabled={submitting}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-left text-xs transition-colors hover:border-navy-300 hover:bg-navy-50 disabled:opacity-60"
                  >
                    <span className="block font-medium text-slate-800">{demoUser.full_name}</span>
                    <span className="mt-0.5 block text-slate-500">{demoUser.employee_number}</span>
                  </button>
                ))}
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-400">
                デモデータは架空です。実在する顧客情報・個人情報・機密情報は入力しないでください。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
