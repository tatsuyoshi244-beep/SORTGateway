# Operations

## Daily

- Monitor `/admin/system` for slow queries and errors
- Review `/admin/unresolved-questions` for knowledge gaps
- Check integration sync status at `/admin/integrations`

## Weekly

- Review `/admin/feedback` negative ratings
- `/admin/knowledge-health` for stale content
- Export analytics CSV for trends

## Scheduled Jobs

| Job | Endpoint | Schedule |
|-----|----------|----------|
| Integration sync | `POST /api/jobs/sync-integrations` | Hourly (Vercel Cron) |

Manual trigger:

```bash
curl -X POST https://your-app.vercel.app/api/jobs/sync-integrations \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Backup

### Supabase Database

```bash
# Using Supabase CLI
supabase db dump -f backup-$(date +%Y%m%d).sql

# Or pg_dump via connection string
pg_dump "$DATABASE_URL" -Fc -f backup.dump
```

**Frequency**: Daily automated (Supabase Pro) or weekly manual.

### Storage (documents bucket)

```bash
# Supabase Storage — export bucket via dashboard or API
supabase storage cp -r ss://documents ./backup/documents-$(date +%Y%m%d)
```

**Local demo mode**: Copy `.data/` directory:

```bash
tar -czf sort-gateway-data-$(date +%Y%m%d).tar.gz .data/
```

### Restore

1. **Database**: `psql` or `supabase db reset` + apply dump
2. **Storage**: Re-upload files to `documents` bucket; re-index if needed
3. **Local**: Extract `.data/` archive to project root

**Test restores quarterly** on staging environment.

## Incident Response

1. Check `/api/health` and `/api/ready`
2. Review recent errors in `/admin/system`
3. Disable affected integration if sync loop fails
4. Rotate `CRON_SECRET` / token passes if compromised

## Logs

- Application errors: server console + `/api/admin/system` buffer
- Audit: `/admin/audit` or Supabase `audit_logs`
- Vercel: Function logs in dashboard

## Versioning

- App version: `package.json` / `NEXT_PUBLIC_APP_VERSION`
- Build SHA: `VERCEL_GIT_COMMIT_SHA` or `BUILD_SHA`
- Display: `/admin/system`
