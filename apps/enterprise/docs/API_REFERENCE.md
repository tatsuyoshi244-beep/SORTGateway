# API Reference

Base URL: `/api`

## Authentication

Include session header (demo):

```
x-sort-session: <base64url encoded SessionUser JSON>
```

Or Bearer token (Supabase):

```
Authorization: Bearer <jwt>
```

## Error Format

```json
{
  "error": {
    "code": "UNAUTHORIZED | FORBIDDEN | NOT_FOUND | VALIDATION_ERROR | INTERNAL_ERROR | SERVICE_UNAVAILABLE",
    "message": "ユーザー向けメッセージ",
    "details": "optional technical detail"
  }
}
```

## Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Liveness + version |
| GET | `/ready` | No | Readiness checks |

## Chat

| Method | Path | Auth | Body |
|--------|------|------|------|
| POST | `/chat` | User | `{ message, hasActiveTokenPass? }` |

Response: `{ payload, chat_log_id }`

## Knowledge

| Method | Path | Auth |
|--------|------|------|
| GET/POST | `/knowledge` | User / Manager+ |
| PATCH | `/knowledge/[id]` | Manager+ |
| GET | `/knowledge/health` | Manager+ |

## Documents

| Method | Path | Auth |
|--------|------|------|
| GET | `/documents` | User |
| POST | `/documents/upload` | User |
| GET/DELETE | `/documents/[id]` | User |

## Integrations

| Method | Path | Auth |
|--------|------|------|
| GET/POST | `/integrations` | Admin |
| PATCH | `/integrations/[id]` | Admin |
| POST | `/integrations/[id]/sync` | Admin |
| POST | `/integrations/[id]/disconnect` | Admin |
| GET | `/integrations/sync-logs` | Admin |

## Jobs

| Method | Path | Auth |
|--------|------|------|
| POST | `/jobs/sync-integrations` | `CRON_SECRET` |

## Analytics

| Method | Path | Auth |
|--------|------|------|
| GET | `/admin/analytics` | Manager+ |
| GET | `/admin/analytics/departments` | Manager+ |
| GET | `/admin/unresolved-questions` | Manager+ |
| PATCH | `/admin/unresolved-questions/[id]` | Manager+ |
| GET | `/admin/system` | Admin |

## Export (CSV)

| Method | Path | Auth |
|--------|------|------|
| GET | `/export/audit` | Manager+ |
| GET | `/export/chat-logs` | Manager+ |
| GET | `/export/unresolved-questions` | Manager+ |
| GET | `/export/feedback` | Manager+ |

## Notifications

| Method | Path | Auth |
|--------|------|------|
| GET | `/notifications` | User |
| PATCH | `/notifications/[id]` | User |

## Audit

| Method | Path | Auth |
|--------|------|------|
| POST | `/audit` | User |

## Admin Stats

| Method | Path | Auth |
|--------|------|------|
| GET | `/admin/stats` | Manager+ |
