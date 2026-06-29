'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { canAccessRoute, type RouteKey } from '@/lib/permissions';
import { ErrorState } from '@/components/ui/ErrorState';

export function RouteGuard({
  route,
  children,
}: {
  route: RouteKey;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !canAccessRoute(user.role, route)) {
      router.replace('/dashboard');
    }
  }, [user, route, router]);

  if (!user) return null;

  if (!canAccessRoute(user.role, route)) {
    return (
      <ErrorState
        message="この画面へのアクセス権限がありません。管理者にお問い合わせください。"
      />
    );
  }

  return <>{children}</>;
}
