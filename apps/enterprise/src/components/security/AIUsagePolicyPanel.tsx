'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Bot, CircleStop, Save, ShieldCheck } from 'lucide-react';
import type { AIUsagePolicy, AIUsageSummary } from '@/types';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api/client';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';

const NUMBER_FIELDS: Array<{
  key: keyof Pick<
    AIUsagePolicy,
    | 'monthly_request_limit'
    | 'daily_user_limit'
    | 'per_minute_limit'
    | 'max_input_chars'
    | 'max_output_chars'
  >;
  label: string;
  description: string;
  min: number;
  max: number;
}> = [
  {
    key: 'monthly_request_limit',
    label: '企業全体の月間回数',
    description: '上限到達後は一般AIを自動停止',
    min: 10,
    max: 100000,
  },
  {
    key: 'daily_user_limit',
    label: '社員1人あたりの1日回数',
    description: '一部社員による使い切りを防止',
    min: 1,
    max: 1000,
  },
  {
    key: 'per_minute_limit',
    label: '企業全体の1分間回数',
    description: '連続送信・自動攻撃を抑制',
    min: 1,
    max: 100,
  },
  {
    key: 'max_input_chars',
    label: '1回の最大入力文字数',
    description: '長文や文書全体の外部送信を抑制',
    min: 100,
    max: 4000,
  },
  {
    key: 'max_output_chars',
    label: '1回答の最大表示文字数',
    description: '回答量と利用コストを抑制',
    min: 200,
    max: 10000,
  },
];

export function AIUsagePolicyPanel() {
  const { user } = useAuth();
  const [policy, setPolicy] = useState<AIUsagePolicy | null>(null);
  const [summary, setSummary] = useState<AIUsageSummary | null>(null);
  const [persistenceReady, setPersistenceReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(user, '/api/admin/ai-policy');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? 'AI利用設定を読み込めませんでした');
      setPolicy(data.policy);
      setSummary(data.summary);
      setPersistenceReady(Boolean(data.persistence_ready));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'AI利用設定を読み込めませんでした');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!user || !policy) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await apiFetch(user, '/api/admin/ai-policy', {
        method: 'PUT',
        body: JSON.stringify(policy),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? 'AI利用設定を保存できませんでした');
      setPolicy(data.policy);
      setPersistenceReady(Boolean(data.persistence_ready));
      setMessage(
        data.persistence_ready
          ? '企業のAI利用ポリシーを保存しました。'
          : 'デモ表示へ反映しました。本番運用にはSupabaseのPhase 16適用が必要です。'
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'AI利用設定を保存できませんでした');
    } finally {
      setSaving(false);
    }
  };

  const updateNumber = (key: (typeof NUMBER_FIELDS)[number]['key'], value: string) => {
    const number = Number(value);
    if (!policy || !Number.isFinite(number)) return;
    setPolicy({ ...policy, [key]: number });
  };

  if (loading) return <p className="text-sm text-slate-500">AI利用ポリシーを読み込んでいます...</p>;
  if (!policy) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-red-700">{error ?? 'AI利用ポリシーを表示できません'}</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {!persistenceReady ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            本番データベースの利用回数管理が未設定です。安全のため外部AI送信は自動停止されます。設定画面はデモできます。
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <p>企業別の利用回数・緊急停止・監査記録を本番データベースで管理しています。</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardBody className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-navy-700" />
                  <h3 className="font-semibold text-slate-900">一般AI利用</h3>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  社内資料を含まない一般質問だけを外部AIへ送信します。
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={policy.general_ai_enabled}
                  onChange={(event) =>
                    setPolicy({ ...policy, general_ai_enabled: event.target.checked })
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                {policy.general_ai_enabled ? '有効' : '無効'}
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {NUMBER_FIELDS.map((field) => (
                <div key={field.key}>
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <Input
                    id={field.key}
                    type="number"
                    min={field.min}
                    max={field.max}
                    value={policy[field.key]}
                    onChange={(event) => updateNumber(field.key, event.target.value)}
                  />
                  <p className="mt-1 text-xs text-slate-500">{field.description}</p>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <p className="font-medium text-slate-800">社内ナレッジ本文の外部送信</p>
              <p className="mt-1 text-slate-600">
                無効（固定）。一般AIの接続後も、社内回答はSORT Gateway内で処理します。
              </p>
            </div>

            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            {message ? <p className="text-sm text-green-700">{message}</p> : null}

            <Button onClick={() => void save()} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? '保存中...' : 'ポリシーを保存'}
            </Button>
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardBody>
              <h3 className="font-semibold text-slate-900">現在の利用状況</h3>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">今月</dt>
                  <dd className="font-medium text-slate-900">
                    {summary?.monthly_used ?? 0} / {policy.monthly_request_limit} 回
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">あなたの本日利用</dt>
                  <dd className="font-medium text-slate-900">
                    {summary?.daily_user_used ?? 0} / {policy.daily_user_limit} 回
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">直近1分</dt>
                  <dd className="font-medium text-slate-900">
                    {summary?.minute_used ?? 0} / {policy.per_minute_limit} 回
                  </dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          <Card className={policy.emergency_stop ? 'border-red-300 bg-red-50' : undefined}>
            <CardBody>
              <div className="flex items-center gap-2">
                <CircleStop className="h-5 w-5 text-red-700" />
                <h3 className="font-semibold text-slate-900">外部AI緊急停止</h3>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                有効にすると一般AIへの送信を即時停止します。社内検索は停止しません。
              </p>
              <label className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-red-800">
                <input
                  type="checkbox"
                  checked={policy.emergency_stop}
                  onChange={(event) =>
                    setPolicy({ ...policy, emergency_stop: event.target.checked })
                  }
                  className="h-4 w-4 rounded border-red-300"
                />
                {policy.emergency_stop ? '緊急停止中' : '停止していません'}
              </label>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
