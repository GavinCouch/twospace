# Configuration

The web server reads environment variables through Next.js. Keep local values in `.env.local`; use the host’s secret settings in production. The [example file](../.env.example) starts in local mode and contains no credentials.

## Local development

`npm run dev` listens on `127.0.0.1:3100`. With `TWOSPACE_STORAGE=local`, account data, shared records, and uploaded files live under `data/`. The server creates its local authentication secret there on first use.

| Variable            | Purpose                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `TWOSPACE_STORAGE`  | `local` for development; `cloud` for PostgreSQL and object storage. If omitted, `DATABASE_URL` selects cloud mode. |
| `BETTER_AUTH_URL`   | Full server origin. Defaults to `http://127.0.0.1:3100`.                                                           |
| `TWOSPACE_DATA_DIR` | Optional local directory for the SQLite database, secret, and media.                                               |

Local email signup does not require verification delivery. Google login and password-reset email remain unavailable until configured. Shared features still require two joined accounts.

## Production

Production requires PostgreSQL, private object storage, an HTTPS origin, and a persistent authentication secret. `npm start` does not support local SQLite mode in production.

| Variable                  | Required value                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| `TWOSPACE_STORAGE`        | `cloud`                                                                                    |
| `DATABASE_URL`            | PostgreSQL connection string for the app database.                                         |
| `BETTER_AUTH_URL`         | The canonical HTTPS origin, with no path.                                                  |
| `BETTER_AUTH_SECRET`      | A random secret of at least 32 characters, kept stable across deployments.                 |
| `SUPABASE_URL`            | Project URL when using Supabase Storage.                                                   |
| `SUPABASE_STORAGE_BUCKET` | Name of an existing **private** bucket.                                                    |
| `SUPABASE_SECRET_KEY`     | A server-only Supabase secret key. The older `SUPABASE_SERVICE_ROLE_KEY` is also accepted. |

Database TLS certificate validation is enabled. `DATABASE_SSL_CA` can supply a PEM CA certificate, using literal `\n` sequences for line breaks when needed. Do not disable certificate verification to resolve connection errors.

The database connection must be able to initialize the private `twospace` schema and run its migrations. Better Auth manages the account tables; the app manages shared records. Initialization runs under a database lock. Supabase Auth is not used, and browser clients do not query the database or storage bucket directly.

The existing deployment uses Render with these commands:

```text
Build: npm ci && npm run build
Start: npm start
Health check: /api/health
```

The server binds to `0.0.0.0` and uses the host’s `PORT`, defaulting to `3100`. The health route checks application readiness, including its storage configuration. Keep production credentials out of build artifacts and version control.

### S3-compatible storage

When `SUPABASE_URL` is not set, cloud mode uses an S3-compatible object store. Configure all of:

```text
S3_ENDPOINT
S3_REGION
S3_BUCKET
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
```

Use a private bucket. These replace the Supabase Storage variables, not `DATABASE_URL` or the authentication settings.

## Account emails

Configure one provider and a verified sender. Email is sent through HTTPS APIs, not SMTP.

| Provider | Variables                                               |
| -------- | ------------------------------------------------------- |
| Brevo    | `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`, `EMAIL_FROM`   |
| Resend   | `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` |

`EMAIL_FROM` accepts an email address or a value such as `TwoSpace <hello@your-domain.example>`. Partial provider configuration is rejected. Cloud email signup requires verification, and the web UI only offers email/password authentication when delivery is configured. Password-reset links use the same provider.

## Google sign-in

Set both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from the app’s Google OAuth client. Register this redirect URI for the configured origin:

```text
https://your-domain.example/api/auth/callback/google
```

For a local web callback, use `http://127.0.0.1:3100/api/auth/callback/google`. Production uses the canonical origin from `BETTER_AUTH_URL`. Native sign-in also uses Better Auth’s Expo integration and the app’s `twospace://` scheme; use a development build rather than Expo Go.

## Spotify

Catalog search uses server-side client credentials: `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`. `SPOTIFY_MARKET` is an optional two-letter market code, defaulting to `US`. Credentials must stay on the server.

Users do not connect their Spotify accounts. TwoSpace stores a track reference and note, then uses Spotify’s official embed and link for playback. When catalog credentials are absent, pasted Spotify track links can use oEmbed. Search access, availability, and playback still depend on Spotify’s app and account restrictions.

## Tests and release checks

The normal web test run uses isolated local databases. PostgreSQL tests need a disposable database named `twospace_test` on a loopback host and are skipped without `TWOSPACE_TEST_POSTGRES_URL`.

Prefer the temporary-cluster helper:

```bash
PG_BIN=/path/to/postgresql/bin node scripts/test-postgres.mjs
```

Alternatively, supply `TWOSPACE_TEST_POSTGRES_URL` privately and run:

```bash
npx vitest run tests/server/postgres.test.ts
```

Use a dedicated test database: the integration suite creates and removes the app schema. Never point it at a live deployment.

For the companion, run `npm run typecheck`, `npm test`, and `npm run export:ios` from `mobile/`. Export validates the JavaScript bundle; it does not establish that device authentication or App Store distribution works.
