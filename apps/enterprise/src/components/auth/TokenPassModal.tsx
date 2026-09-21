'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { allowsDemoAuth, DEMO_TOKEN_PASS_CODE } from '@/lib/env';
import { CLASSIFICATION_LABELS } from '@/lib/permissions';

export function TokenPassModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, applyTokenPass, clearTokenPass, activeTokenPass } = useAuth();
  const [code, setCode] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleApply = async () => {
    setLoading(true);
    setError('');
    const result = await applyTokenPass(code, reason);
    setLoading(false);
    if (result.ok) {
      setCode('');
      setReason('');
      onClose();
    } else {
      setError(result.error ?? '適用に失敗しました');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-bold text-slate-900">トークンパス入力</h2>
        <p className="mt-2 text-sm text-slate-500">
          企業管理者から自分のアカウントへ発行されたパスを、利用理由とともに適用します。
        </p>
        <p className="mt-1 text-xs text-slate-400">
          企業: {user?.company_name ?? '—'} · 利用者: {user?.full_name ?? '—'}
        </p>
        {activeTokenPass && (
          <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <p>適用中: {activeTokenPass.label}</p>
            <p className="mt-1 text-xs">
              対象: {activeTokenPass.classification_scope.map((scope) => CLASSIFICATION_LABELS[scope]).join('、')}
              {' · '}期限: {new Date(activeTokenPass.expires_at).toLocaleDateString('ja-JP')}
            </p>
          </div>
        )}
        {allowsDemoAuth() && !activeTokenPass && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-sm font-medium text-blue-900">公開デモ用</p>
            <p className="mt-1 text-xs text-blue-800">
              「鈴木 一郎（EXE-001）」に発行済みのパスを入力できます。
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-2"
              onClick={() => {
                setCode(DEMO_TOKEN_PASS_CODE);
                setReason('役員向け機密ナレッジのデモ確認');
                setError('');
              }}
            >
              デモパスを入力
            </Button>
          </div>
        )}
        <div className="mt-4">
          <Label htmlFor="token-code">トークンコード</Label>
          <Input
            id="token-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="例: EXEC-2026-Q2-A1B2"
            className="mt-1 font-mono"
          />
        </div>
        <div className="mt-4">
          <Label htmlFor="access-reason">利用理由</Label>
          <Input
            id="access-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="例: 役員会資料の確認"
            maxLength={200}
            className="mt-1"
          />
          <p className="mt-1 text-xs text-slate-400">監査ログに記録されます</p>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex gap-2">
          <Button onClick={handleApply} disabled={loading || !code.trim() || reason.trim().length < 2}>
            {loading ? '確認中...' : '適用'}
          </Button>
          {activeTokenPass && (
            <Button
              variant="ghost"
              onClick={() => {
                clearTokenPass();
                onClose();
              }}
            >
              解除
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
