# public.charity — platform

A free, open platform for charities: a public directory with a page for every
charity, and optional modules they can adopt when they're ready. Built and
given away to promote the efficiency and effectiveness of charities.

## Principles

- **Free for charities, forever.**
- **Donations never touch the platform** — every donate link goes directly to
  the charity's own payment provider.
- **Verified listings** against the official charity register.
- **Nothing is compulsory** — a charity that only wants a listing never sees
  the rest.
- **Open source** (Apache-2.0), self-hostable by other organisations.

## Stack

Next.js (App Router) · TypeScript · Prisma 7 · PostgreSQL · Fly.io.
Magic-link auth, no passwords. Multi-tenant from the first commit.

## Development

```sh
npm install
# local postgres, then:
npx prisma migrate dev
npx tsx prisma/seed.ts
npm run dev
```

`.env` needs `DATABASE_URL`. Optional: `CCEW_API_KEY` (charity register
lookup), `RESEND_API_KEY` + `EMAIL_FROM` (outbound email; without it magic
links are logged to stdout), `BASE_URL`.

## Deployment

Fly.io: `fly deploy`. Migrations run in the release command.
