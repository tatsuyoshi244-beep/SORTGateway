'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api/client';
import type { AppNotification } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/utils';

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await apiFetch(user, '/api/notifications');
      const data = await res.json();
      if (data.notifications) setNotifications(data.notifications);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = async (id: string) => {
    if (!user) return;
    await apiFetch(user, `/api/notifications/${id}`, { method: 'PATCH' });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  };

  if (!user) return null;

  return (
    <div>
      <PageHeader
        title="通知"
        description="ナレッジ公開・外部連携同期などの更新通知"
      />

      {loading ? (
        <p className="text-sm text-slate-500">読み込み中...</p>
      ) : notifications.length === 0 ? (
        <EmptyState title="通知はありません" />
      ) : (
        <ul className="space-y-3">
          {notifications.map((n) => (
            <li key={n.id}>
              <Card className={n.is_read ? 'opacity-70' : 'border-navy-200'}>
                <CardBody className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <Bell className={`mt-0.5 h-5 w-5 shrink-0 ${n.is_read ? 'text-slate-400' : 'text-navy-600'}`} />
                    <div>
                      <p className="font-medium text-slate-900">{n.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{n.message}</p>
                      <p className="mt-2 text-xs text-slate-400">{formatDate(n.created_at)}</p>
                    </div>
                  </div>
                  {!n.is_read && (
                    <Button size="sm" variant="secondary" onClick={() => void markRead(n.id)}>
                      既読
                    </Button>
                  )}
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
