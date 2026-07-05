# ShredAfterReading

ShredAfterReading is a Docker Compose app for self-destructing text shares. It ships with:

- Nginx fronting a React app and an Express + Prisma API
- PostgreSQL for users, sessions, SARs, and settings
- Mailpit for local email verification
- Public `/sar/<id>` links with optional per-SAR passwords
- An `/administration` area for user moderation, SAR inspection, and global expiry control

## Prerequisites

- Node.js 24+
- npm
- Docker with the Compose v2 plugin
- `python3` for the smoke scripts

## Local Setup

1. Install dependencies:

   ```bash
   (cd apps/api && npm install)
   (cd apps/web && npm install)
   ```

   Dependencies now live only under `apps/api/node_modules` and `apps/web/node_modules`; the repo root has no shared Node workspace.

2. Copy the root app env file and change at least `ADMIN_PASSWORD` before exposing the stack beyond your machine:

   ```bash
   cp .env.example .env
   ```

3. Review `compose-helper.env` if you want to override helper-only behavior such as the compose project name or log tail length.

4. Start the stack with the helper, not raw `docker compose`:

   ```bash
   ./compose-helper.sh rebuild
   ```

5. Open:

   - Main app: `http://localhost:8080`
   - Admin app: `http://localhost:8080/administration`
   - Mailpit: `http://localhost:8025`

## Environment Variables

### Compose stack

`compose-helper.env` is now helper-only configuration:

- `DCH_PROJECT_NAME`, `DCH_STOP_TIMEOUT`, `DCH_LOGS_TAIL`

The real app and stack settings live in the root `.env` / `.env.example`:

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `APP_PORT`
- `PORT`, `BODY_SIZE_LIMIT`
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- `DATABASE_URL`
- `APP_BASE_URL`, `COOKIE_SECURE`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM_ADDRESS`
- `SESSION_TTL_HOURS`, `REMEMBER_ME_TTL_DAYS`, `EMAIL_VERIFICATION_TTL_DAYS`

### Host-side API / Prisma commands

The API and Prisma host-side commands also read the root `.env`, so there is no second app env file to keep in sync.

## Compose Helper Commands

Use `./compose-helper.sh`, not raw `docker compose`, for normal project operations.

The helper is surfaced at the root, while the actual compose stack files live under `.compose/` so the project root stays cleaner.

- Validate compose config: `./compose-helper.sh config --quiet`
- Build and start: `./compose-helper.sh rebuild`
- Start without rebuilding: `./compose-helper.sh start`
- Stop without wiping volumes: `./compose-helper.sh stop`
- Inspect services: `./compose-helper.sh ps`
- Read recent logs without following forever: `./compose-helper.sh logs --tail=100`

Never run `./compose-helper.sh down` unless you explicitly want to wipe named volumes.

## Mailpit Verification Flow

Local registrations send email through Mailpit. You can:

- Open `http://localhost:8025`
- Find the verification email
- Open the `verify-email` link inside it

The auth smoke test automates that flow:

```bash
bash scripts/smoke-auth.sh
```

## Admin Bootstrap

On seed, the API creates or promotes the account from `ADMIN_EMAIL` / `ADMIN_PASSWORD` and marks it verified. That account can sign in on `http://localhost:8080/administration`.

## Testing And Verification

App checks:

```bash
(cd apps/api && npm run build && npm run typecheck && npm run lint && npm run test)
(cd apps/web && npm run build && npm run typecheck && npm run test)
```

API-only checks:

```bash
cd apps/api
npm run test
npm run typecheck
npm run lint
npm run build
npx prisma validate --schema prisma/schema.prisma
```

Web-only checks:

```bash
cd apps/web
npm run test
npm run typecheck
npm run build
```

Docker smoke checks:

```bash
bash scripts/smoke-auth.sh
bash scripts/smoke-sar.sh
bash scripts/smoke-admin.sh
```

## Security Choices

The current security and lifecycle contract is:

- Raw HTML inside Markdown is disabled; scripts and unsafe URLs must never execute.
- Plain-text SARs render as text, not HTML.
- Email verification is required before protected user actions.
- Sessions are opaque, server-side, and stored hashed at rest.
- SAR passwords are optional per note and stored only as strong hashes.
- Owner deletes are soft deletes; expired and deleted SARs remain admin-visible for 30 days, then cleanup purges them.
- Admins can lower the global expiry limit for future SAR creation and future expiry edits, but existing SAR expiries are left unchanged.

## License

[0BSD](LICENSE)
