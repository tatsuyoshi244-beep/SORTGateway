'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';

export function TokenPassModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { applyTokenPass, clearTokenPass, activeTokenPass } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleApply = async () => {
    setLoading(true);
    setError('');
    const result = await applyTokenPass(code);
    setLoading(false);
    if (result.ok) {
      setCode('');
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
          機密・役員限定情報へアクセスするには、発行されたトークンパスを入力してください。
        </p>
        {activeTokenPass && (
          <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            適用中: {activeTokenPass.label}（期限: {new Date(activeTokenPass.expires_at).toLocaleDateString('ja-JP')}）
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
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex gap-2">
          <Button onClick={handleApply} disabled={loading || !code.trim()}>
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
