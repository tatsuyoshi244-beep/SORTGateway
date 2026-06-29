# SORT Gateway Enterprise — Architecture

## Overview

SORT Gateway v2.1 Enterprise is a Next.js 14 (App Router) multi-tenant knowledge gateway for internal AI chat, document RAG, knowledge lifecycle, and external integrations.

```
apps/enterprise/
  src/app/          # Pages + API routes (App Router)
  src/components/   # UI components
  src/lib/          # Business logic
    analytics/      # Chat logs, metrics
    integrations/   # External sync adapters
    knowledge/      # Lifecycle, search, workflow
    rag/            # RAG search + chunking
    documents/      # Upload, extract, index
    api/            # Auth guard, errors, validation
    observability/  # Logging, timing
    cache/          # In-memory cache abstraction
  supabase/         # SQL schema (phases 5–10)
  e2e/              # Playwright tests
```

## Request Flow

1. **Browser** → Next.js page (client) or API route (server)
2. **Auth** → `x-sort-session` header (demo) or Supabase Bearer token
3. **Tenant** → `company_id` from session / super_admin override
4. **Chat** → RAG search → LLM generate → chat_log persist → audit

## Data Stores

| Layer | Demo | Production |
|-------|------|------------|
| Users / companies | `mock-data.ts` | Supabase |
| Knowledge / feedback | `.data/lifecycle-store.json` | Supabase |
| Documents | `.data/` + local files | Supabase Storage |
| Integrations | `.data/integrations-store.json` | Supabase |
| Chat logs | `.data/chat-logs-store.json` | Supabase `chat_logs` |

## Multi-Tenancy

- All queries scoped by `company_id`
- `super_admin` can switch tenant via header override
- RLS policies in Supabase schema (apply in production)

## Extension Points

- **Integrations**: `src/lib/integrations/adapters/*`
- **RAG**: Replace keyword search with vector DB
- **Cache**: Swap `MemoryCache` for Redis
- **Auth**: Supabase Auth (already wired)

## Phase Map

| Phase | Focus |
|-------|-------|
| 5 | Multi-tenant |
| 6 | Security / audit |
| 7 | Knowledge lifecycle |
| 8 | External integrations |
| 9 | Scheduled sync |
| 10 | Analytics |
| 11 | Production quality (tests, health, CI) |
