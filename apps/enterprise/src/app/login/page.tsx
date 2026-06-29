'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { allowsDemoAuth } from '@/lib/env';
import { DEMO_PASSWORD, MOCK_USERS } from '@/lib/mock-data';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { RoleBadge } from '@/components/ui/Badge';

export default function LoginPage() {
  const { user, login, isLoading, isSupabaseAuth } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && user) router.replace('/dashboard');
  }, [user, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const result = await login(email, password);
    setSubmitting(false);
    if (result.ok) {
      router.push('/dashboard');
    } else {
      setError(result.error ?? 'ログインに失敗しました');
    }
  };

  const quickLogin = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    setSubmitting(true);
    const result = await login(demoEmail, DEMO_PASSWORD);
    setSubmitting(false);
    if (result.ok) router.push('/dashboard');
    else setError(result.error ?? 'ログインに失敗しました');
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
              ? 'Supabase Auth でサインインします'
              : allowsDemoAuth()
                ? '社内アカウントでサインインしてください（デモモード）'
                : '本番環境です。Supabase で作成したアカウントでサインインしてください。'}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.local"
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
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              {submitting ? 'サインイン中...' : 'サインイン'}
            </Button>
          </form>

          {!allowsDemoAuth() ? null : (
          <div className="mt-10 border-t border-slate-200 pt-8">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
              デモアカウント（開発用）
            </p>
            <div className="space-y-2">
              {MOCK_USERS.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => quickLogin(u.email)}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-left text-sm hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-800">{u.full_name}</span>
                  <RoleBadge role={u.role} />
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-400">
              パスワード: <code className="rounded bg-slate-100 px-1">{DEMO_PASSWORD}</code>
            </p>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
