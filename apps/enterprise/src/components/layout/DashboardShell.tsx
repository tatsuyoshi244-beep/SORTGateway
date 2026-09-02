'use client';

import { KeyRound, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from './Sidebar';
import { TenantSwitcher } from '@/components/layout/TenantSwitcher';
import { TokenPassModal } from '@/components/auth/TokenPassModal';
import { Button } from '@/components/ui/Button';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading, effectiveCompanyName } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tokenModalOpen, setTokenModalOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">読み込み中...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl">
            <div className="flex justify-end p-2">
              <button type="button" onClick={() => setMobileOpen(false)} className="p-2">
                <X className="h-5 w-5" />
              </button>
            </div>
            <Sidebar />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden flex-col text-sm lg:flex">
            <span className="font-medium text-navy-800">{effectiveCompanyName}</span>
            <span className="text-slate-500">
              {user.department_name ?? '全社'} · {user.full_name}
            </span>
          </div>
          <TenantSwitcher />
          <Button variant="ghost" size="sm" className="shrink-0 whitespace-nowrap" onClick={() => setTokenModalOpen(true)}>
            <KeyRound className="h-4 w-4" />
            トークンパス入力
          </Button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">{children}</main>
      </div>

      <TokenPassModal open={tokenModalOpen} onClose={() => setTokenModalOpen(false)} />
    </div>
  );
}
