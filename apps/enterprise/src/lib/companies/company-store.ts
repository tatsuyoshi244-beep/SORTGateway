import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { Company, CompanyPlan, CompanyStatus } from '@/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAdminConfigured } from '@/lib/env';
import { MOCK_COMPANIES } from '@/lib/mock-companies';
import { DEMO_COMPANY_ID } from '@/lib/tenant/constants';
import { MOCK_USERS } from '@/lib/mock-data';
import { MOCK_DOCUMENTS } from '@/lib/mock-documents';

const INDEX_FILE = 'companies-index.json';

function dataPath(): string {
  return path.join(process.cwd(), '.data', INDEX_FILE);
}

async function readLocal(): Promise<Company[]> {
  try {
    const raw = await fs.readFile(dataPath(), 'utf-8');
    return JSON.parse(raw) as Company[];
  } catch {
    return [...MOCK_COMPANIES];
  }
}

async function writeLocal(companies: Company[]): Promise<void> {
  await fs.mkdir(path.dirname(dataPath()), { recursive: true });
  await fs.writeFile(dataPath(), JSON.stringify(companies, null, 2), 'utf-8');
}

function mapRow(row: Record<string, unknown>): Company {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    plan: row.plan as CompanyPlan,
    status: row.status as CompanyStatus,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function enrichStats(companies: Company[]): Company[] {
  return companies.map((c) => ({
    ...c,
    user_count: MOCK_USERS.filter((u) => u.company_id === c.id).length,
    document_count: MOCK_DOCUMENTS.filter((d) => d.company_id === c.id).length,
    last_activity_at: c.last_activity_at ?? c.updated_at,
  }));
}

export async function listCompanies(): Promise<Company[]> {
  if (isSupabaseAdminConfigured()) {
    const client = createAdminClient();
    if (client) {
      const { data, error } = await client.from('companies').select('*').order('name');
      if (!error && data) {
        return data.map((r) => mapRow(r as Record<string, unknown>));
      }
    }
  }
  return enrichStats(await readLocal());
}

export interface CreateCompanyInput {
  name: string;
  slug: string;
  plan?: CompanyPlan;
}

export async function createCompany(input: CreateCompanyInput): Promise<Company> {
  const now = new Date().toISOString();
  const company: Company = {
    id: randomUUID(),
    name: input.name,
    slug: input.slug,
    plan: input.plan ?? 'standard',
    status: 'trial',
    created_at: now,
    updated_at: now,
    user_count: 0,
    document_count: 0,
    last_activity_at: null,
  };

  if (isSupabaseAdminConfigured()) {
    const client = createAdminClient();
    if (client) {
      const { data, error } = await client.from('companies').insert(company).select('*').single();
      if (!error && data) {
        const created = mapRow(data as Record<string, unknown>);
        await seedCompanyDefaults(client, created);
        return created;
      }
    }
  }

  const list = await readLocal();
  list.push(company);
  await writeLocal(list);
  return company;
}

async function seedCompanyDefaults(
  client: NonNullable<ReturnType<typeof createAdminClient>>,
  company: Company
): Promise<void> {
  await client.from('departments').insert({
    company_id: company.id,
    name: '本社',
    code: 'HQ',
  });
}

export async function updateCompanyStatus(
  id: string,
  status: CompanyStatus
): Promise<Company | null> {
  const now = new Date().toISOString();

  if (isSupabaseAdminConfigured()) {
    const client = createAdminClient();
    if (client) {
      const { data, error } = await client
        .from('companies')
        .update({ status, updated_at: now })
        .eq('id', id)
        .select('*')
        .single();
      if (!error && data) return mapRow(data as Record<string, unknown>);
    }
  }

  const list = await readLocal();
  const i = list.findIndex((c) => c.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i], status, updated_at: now };
  await writeLocal(list);
  return list[i];
}

export function getCompanyById(id: string, companies: Company[]): Company | undefined {
  return companies.find((c) => c.id === id);
}

export { DEMO_COMPANY_ID };
