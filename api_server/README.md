# Holotrace authentication API

This Bun service owns Holotrace authentication. Better Auth provides the HTTP routes and session cookies, while its
Drizzle adapter stores authentication data in the PostgreSQL `auth` schema. The service also owns authenticated
saved-circuit requests backed by the public-schema `projects` table. The existing Python model API remains separate.

## Local setup

```bash
bun install
cp .env.example .env
bun run db:migrate
bun run dev
```

Set real values in `.env` before running the server. `BETTER_AUTH_SECRET` must be a high-entropy value with at least
32 characters. Do not expose `DATABASE_URL`, `BETTER_AUTH_SECRET`, or `INTERNAL_AUTH_TOKEN` to the Svelte client.

Useful commands:

```bash
bun run check
bun run db:generate
bun run db:migrate
bun run start
```

## Routes

Better Auth is mounted below `/api/auth`. The username plugin adds username login to its standard email-and-password
account flow.

```text
POST /api/auth/sign-up/email
POST /api/auth/sign-in/username
POST /api/auth/sign-out
GET  /api/auth/get-session
GET  /api/circuits
POST /api/circuits
GET  /api/circuits/:id
PUT  /api/circuits/:id
DELETE /api/circuits/:id
GET  /health
GET  /internal/authorize
```

Signup requires a display name, email, username, and password. Login requires only the username and password.
Passwords are owned and hashed by Better Auth in `auth.account`; they must never be copied into the legacy `users`
table or sent to the model service.

The auth cookie is `Secure`, `HttpOnly`, and `SameSite=None` so the Tauri webview and local Svelte development origin
can retain a session while calling the deployed HTTPS API. Better Auth's origin checks and the credentialed CORS
allowlist remain enabled; every client origin must be listed in `AUTH_TRUSTED_ORIGINS`.

Circuit routes require a valid Better Auth session. `public.projects.owner` references `auth.user.id`, and every read,
update, or delete includes that owner in its database predicate. Circuit JSON is limited to 2 MB per saved project.

`/internal/authorize` is intended for a reverse proxy's private authentication subrequest. It validates the Better
Auth session cookie and returns `X-Holotrace-User-Id` on success. When `INTERNAL_AUTH_TOKEN` is configured, the proxy
must supply the same value in `X-Internal-Auth-Token`. Do not expose this route directly through the public proxy.

## Keeping the Python API unchanged

In production, route `/api/auth/*` to this service and leave the remaining paths pointed at the Python model API:

```text
api.ifyousmellityouwilleventuallydie.tech
  /api/auth/*       -> Holotrace Bun API
  /api/circuits*    -> Holotrace Bun API
  everything else   -> existing Python model API
```

This preserves the Python implementation and its existing authorization behavior. To require Better Auth sessions
for the Python routes later, configure Caddy `forward_auth` to call the private `/internal/authorize` endpoint before
proxying a request to Python. Authentication at the proxy only proves who the caller is; project- and
workspace-specific authorization still belongs in an application API boundary.

## Source layout

```text
src/auth.ts            Better Auth and username/password configuration
src/authorize.ts       Private reverse-proxy authentication endpoint
src/circuits.ts        Authenticated saved-circuit CRUD
src/config.ts          Runtime environment validation
src/cors.ts            Credentialed browser-request CORS handling
src/db/auth-schema.ts  Better Auth's isolated Drizzle schema
src/db/index.ts        PostgreSQL pool and Drizzle client
src/db/schema.ts       Simplified saved-project schema linked to Better Auth users
deploy/                User service and Caddy routing examples
```
