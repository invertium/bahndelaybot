# BahnDelay

BahnDelay is a small, invite-only German PWA for following a journey, seeing
live Deutsche Bahn delays, and finding practical multimodal alternatives when
a connection is missed. It is designed for friends and family: it does not
store DB credentials or original ticket files.

## Local development

The project uses [Bun](https://bun.sh/) (the repository pins Bun 1.4.0) and
Next.js. Install dependencies and start the development server with:

```sh
bun install
cp .env.example .env.local
bun run dev
```

Useful checks are `bun run lint`, `bun run typecheck`, `bun run test`, and
`bun run test:e2e`. Playwright's mobile project starts the local server when
`PLAYWRIGHT_BASE_URL` is not set. To test a deployed preview, set that variable
to the exact deployment URL.

## Services and environment

The production-compatible defaults are:

- Vercel for hosting and preview deployments.
- Neon Postgres, provisioned through the Vercel Marketplace, accessed with
  Drizzle ORM and Neon's serverless driver.
- Resend, provisioned through the Vercel Marketplace, for invitation and
  Better Auth magic-link email.
- Better Auth with the Drizzle adapter for passwordless sessions.
- Transitous/MOTIS for multimodal routing and public transport data.

Copy `.env.example` and set these server-only values:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string |
| `BETTER_AUTH_SECRET` | Long random secret used to sign/authenticate sessions |
| `BETTER_AUTH_URL` | Exact canonical app URL; use the exact Vercel preview URL on previews |
| `RESEND_API_KEY` | Resend API key |
| `EMAIL_FROM` | Verified sender, for example `BahnDelay <login@example.com>` |
| `BOOTSTRAP_ADMIN_EMAIL` | Server-only first administrator email |
| `TRANSITOUS_USER_AGENT` | Contactable application identifier for provider requests |
| `APP_CONTACT_EMAIL` | Address shown to members who need help |

Never expose these values with `NEXT_PUBLIC_`. Vercel environment variables
should be configured separately for Development, Preview, and Production.
Neon branches/databases should likewise be isolated by environment.

## Database migrations

Generate a migration after schema changes, review it, then apply it to the
target database:

```sh
bun --env-file=.env.local run db:generate
bun --env-file=.env.local run db:migrate
```

Run migrations explicitly before deploying code that depends on them. Prefer
backward-compatible additive migrations so an existing Vercel deployment can
be rolled back safely. `bun run db:studio` is for local inspection only.

## Vercel deployment

Link the repository with the Vercel CLI, or import it in the Vercel dashboard.
Install the Neon and Resend Marketplace integrations and pull environment
variables for the relevant environment. Vercel should use the Bun package
manager and the repository's `bun.lock`.

Recommended release sequence:

1. Apply compatible migrations to the preview database and deploy a preview.
2. Run unit, type, build, and mobile E2E checks against that exact preview URL.
3. Apply compatible migrations to production.
4. Deploy without changing the production domain, smoke-test the deployment,
   then promote it.

For rollback, point the domain back to the last known-good Vercel deployment.
Only then reverse a database change, and only when the migration is known to be
safe to reverse; this is why schema migrations should remain additive first.

## Authentication and privacy

Access is invite-only. The bootstrap administrator creates an email-bound,
expiring invitation. Better Auth sends a single-use magic link through Resend;
unauthorized authenticated users remain without membership. Login responses
must not reveal whether an email is registered.

Ticket PDFs are parsed in memory and discarded immediately. Only the minimum
journey data needed to show and replan a trip is retained. Passenger names,
booking references, prices, payment details, DB credentials, and original files
must not be persisted. DB journey links are allowlisted and fetched with SSRF
protections; scanned PDFs requiring OCR are unsupported in the first version.

## Transitous attribution and terms

Routing uses Transitous/MOTIS and may combine public transport and other
mobility providers. Coverage, predictions, and availability can vary. The UI
must show whether data is live, scheduled, stale, or unavailable and include
the required Transitous and OpenStreetMap attribution wherever their data is
shown. Follow the current Transitous/MOTIS API terms, attribution requirements,
rate limits, and data-source licenses; contact the Transitous team before
sustained production use.

## License

This project is released under the MIT License. See [LICENSE](LICENSE).
