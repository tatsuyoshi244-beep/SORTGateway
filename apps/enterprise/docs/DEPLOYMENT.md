# Deployment

## Prerequisites

- Node.js 20+
- npm 10+
- Supabase project (required for production)
- Vercel account (recommended)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | **Prod** | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Prod** | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Prod** | Server-side admin |
| `OPENAI_API_KEY` | Recommended | Real AI responses; missing → mock + `/api/ready` warning |
| `CRON_SECRET` | **Prod** | Scheduled sync auth |
| `INTEGRATION_CREDENTIALS_KEY` | Recommended | Credential encryption |
| `BUILD_SHA` / `BUILD_TIME` | Optional | Build metadata |
| `NEXT_PUBLIC_APP_VERSION` | Optional | Display version |

`NODE_ENV=production` is set automatically on Vercel. In production:

- Demo login (`SortGateway2026!`) is **disabled**
- `x-sort-session` header is **rejected** (Supabase JWT only)
- `CRON_SECRET` is **required** for cron endpoints

See [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) for the full checklist.

## Database Setup

### Recommended (single file)

Supabase SQL Editor:

```text
supabase/production-setup.sql
```

### Individual phases

1. `supabase/schema.sql`
2. `schema-phase5-tenant.sql`
3. `schema-phase6-security.sql`
4. `schema-phase7-lifecycle.sql`
5. `schema-phase8-integrations.sql`
6. `schema-phase9-scheduling.sql`
7. `schema-phase10-analytics.sql`
8. `schema-phase12-production.sql` (schema version + Storage bucket)

### Initial data

After creating Auth users in Supabase Dashboard:

```text
supabase/seed-production-demo.sql
```

Replace `:SUPER_ADMIN_AUTH_UUID` and `:ADMIN_AUTH_UUID` before running.

## Vercel Configuration

| Setting | Value |
|---------|-------|
| **Root Directory** | `apps/enterprise` |
| **Framework** | Next.js |
| **Build Command** | `npm run build` |
| **Output Directory** | `.next` (default; set in `vercel.json`) |
| **Install Command** | `npm install` |

`vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "installCommand": "npm install",
  "crons": [
    { "path": "/api/jobs/sync-integrations", "schedule": "0 * * * *" }
  ]
}
```

### Deploy

```bash
cd apps/enterprise
vercel link
vercel env add CRON_SECRET production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel deploy --prod
```

## Health Checks

- **Liveness**: `GET /api/health` → 200 `{ "status": "ok" }`
- **Readiness**: `GET /api/ready`

### Development (`NODE_ENV !== production`)

Ready when `.data/` is writable.

### Production

Ready when all checks pass:

| Check | Description |
|-------|-------------|
| `supabase` | URL + anon key configured |
| `supabase_connection` | DB reachable |
| `supabase_admin` | Service role configured |
| `auth` | Supabase Auth configured |
| `storage_bucket` | `documents` bucket exists |
| `cron_secret` | `CRON_SECRET` set |
| `schema_version` | Latest migration = `phase10` |
| `openai` | Optional; missing adds **warning** |

## Build

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

## Post-Deploy

1. Verify `/api/ready` → `ready: true`
2. Follow [DEPLOYMENT_VERIFICATION.md](./DEPLOYMENT_VERIFICATION.md)
3. Confirm cron in Vercel dashboard
4. Review `/admin/system` for version/build info
