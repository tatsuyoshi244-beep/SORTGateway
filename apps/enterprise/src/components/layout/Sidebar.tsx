'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowRightLeft,
  BookOpen,
  FileText,
  FileStack,
  FolderSync,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  ScrollText,
  Settings,
  Shield,
  ShieldCheck,
  Building2,
  UserCog,
  Users,
  Activity,
  ThumbsUp,
  Bell,
  Plug,
  BarChart3,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { getNavForRole, type NavItem } from '@/lib/permissions';
import { RoleBadge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  MessageSquare,
  BookOpen,
  ArrowRightLeft,
  Users,
  Shield,
  FileText,
  FileStack,
  UserCog,
  KeyRound,
  ScrollText,
  FolderSync,
  Building2,
  Settings,
  ShieldCheck,
  Activity,
  ThumbsUp,
  Bell,
  Plug,
  BarChart3,
  HelpCircle,
};

const SECTION_LABELS: Record<NavItem['section'], string> = {
  main: 'メイン',
  management: '管理',
  admin: '管理者',
  system: 'システム',
};

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout, activeTokenPass } = useAuth();

  if (!user) return null;

  const nav = getNavForRole(user.role);
  const sections = ['main', 'management', 'admin', 'system'] as const;

  return (
    <aside className="flex h-full w-64 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-800 text-xs font-bold text-white">
            SG
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">SORT Gateway</p>
            <p className="text-xs text-slate-500">v2.1 Enterprise</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section) => {
          const items = nav.filter((n) => n.section === section);
          if (items.length === 0) return null;
          return (
            <div key={section} className="mb-5">
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {SECTION_LABELS[section]}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const Icon = ICONS[item.icon] ?? LayoutDashboard;
                  const active =
                    pathname === item.href ||
                    (item.href !== '/dashboard' && pathname.startsWith(item.href));
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                          active
                            ? 'bg-navy-50 font-medium text-navy-800'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 p-4">
        <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2">
          <p className="truncate text-sm font-medium text-slate-900">{user.full_name}</p>
          <p className="truncate text-xs text-slate-500">{user.email}</p>
          <div className="mt-2">
            <RoleBadge role={user.role} />
          </div>
          {activeTokenPass && (
            <p className="mt-2 text-xs text-amber-700">
              トークン: {activeTokenPass.label}
            </p>
          )}
        </div>
        <button
          type="button"
          data-testid="logout-button"
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-red-50 hover:text-red-700"
        >
          <LogOut className="h-4 w-4" />
          ログアウト
        </button>
      </div>
    </aside>
  );
}
