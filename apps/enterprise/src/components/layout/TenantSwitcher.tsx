'use client';

import { useAuth } from '@/lib/auth-context';

export function TenantSwitcher() {
  const {
    user,
    effectiveCompanyId,
    effectiveCompanyName,
    availableCompanies,
    setActiveTenant,
    clearActiveTenant,
  } = useAuth();

  if (!user || user.role !== 'super_admin') return null;

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="tenant-switch" className="sr-only">
        企業切替
      </label>
      <select
        id="tenant-switch"
        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
        value={effectiveCompanyId}
        onChange={(e) => {
          const id = e.target.value;
          const company = availableCompanies.find((c) => c.id === id);
          if (company) setActiveTenant(company.id, company.name);
        }}
      >
        {availableCompanies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {user.tenant_company_id && (
        <button
          type="button"
          className="text-xs text-slate-500 hover:text-slate-700"
          onClick={clearActiveTenant}
        >
          リセット
        </button>
      )}
      <span className="hidden text-xs text-slate-400 sm:inline">
        操作中: {effectiveCompanyName}
      </span>
    </div>
  );
}
