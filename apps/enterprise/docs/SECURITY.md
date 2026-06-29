# Security

## Authentication

- **Demo mode**: Session encoded in `x-sort-session` (base64 JSON). Development only.
- **Production**: Supabase Auth JWT via `Authorization: Bearer`
- Passwords never stored in client; demo uses shared `DEMO_PASSWORD`

## Authorization

- Role-based: `employee` → `manager` → `executive` → `admin` → `super_admin`
- Route guards: `src/lib/permissions.ts` + `RouteGuard` component
- API guards: `authenticateRequest`, `requireAdmin`, `requireManagerOrAbove`

## Information Classification

| Level | Access |
|-------|--------|
| internal | All employees |
| department | Same department or elevated roles |
| confidential | Manager+ or active token pass |
| executive_only | Executive / admin |

## Credentials

- Integration OAuth tokens: `encrypted_credentials` (stub encryption — replace with KMS in production)
- Token passes: hashed with `hashToken()`, never logged in plain text
- `CRON_SECRET` for scheduled sync jobs

## Audit

- Actions logged to `audit_logs` (login, chat, document, integration, admin)
- IP / User-Agent recorded when configured
- Retention: 365 days (policy display; enforcement via ops)

## API Errors

- Unified format: `{ error: { code, message, details? } }`
- User-facing messages in Japanese; internal details server-side only

## Recommendations for Production

1. Enable Supabase RLS on all tables
2. Replace session header with JWT-only auth
3. KMS for integration credentials
4. WAF / rate limiting on `/api/chat`
5. PII masking on CSV exports
