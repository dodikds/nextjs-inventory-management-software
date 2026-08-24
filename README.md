# GildedGlow Inventory

A Next.js 16 (App Router) inventory & POS admin panel, styled with the GildedGlow design
system (`app/gildedglow.css`), backed by Prisma + MySQL, with Auth.js v5 credentials-based
authentication.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   Copy `.env.example` to `.env` and fill in real values:

   ```bash
   cp .env.example .env
   ```

   - `DATABASE_URL` — a MySQL connection string. The database itself (e.g. `nextinventory`)
     must already exist; Prisma migrates the schema into it but doesn't create the database.
   - `NEXTAUTH_SECRET` — any long random string (used to encrypt session JWTs).
   - `NEXTAUTH_URL` — the app's base URL (`http://localhost:3000` in development).

3. **Run migrations**

   ```bash
   npx prisma migrate dev
   ```

   > **Windows note:** if a `next dev` server is already running, `prisma migrate dev` (and
   > `prisma generate`) can fail with `EPERM: operation not permitted` while regenerating the
   > Prisma Client — Windows locks the query-engine `.dll` while a running Node process has it
   > loaded. Stop the dev server first, then re-run the command.

4. **Seed the database**

   ```bash
   npm run db:seed
   ```

   This upserts one admin user (email `dodikds@gmail.com`, password `12345678` — change it
   after first login via the Change Password page) and ~25 sample suppliers, so the Suppliers
   list has enough rows to actually exercise pagination.

5. **Start the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) and sign in with the seeded admin
   account.

## Other scripts

| Script             | What it does                                              |
| ------------------- | ---------------------------------------------------------- |
| `npm run build`     | Production build                                           |
| `npm run start`     | Start the production server (after `build`)                |
| `npm run lint`      | ESLint                                                      |
| `npm run db:push`   | Push the Prisma schema to the DB without creating a migration (quick prototyping) |
| `npm run db:migrate`| `prisma migrate dev` — create + apply a migration           |
| `npm run db:seed`   | Run `prisma/seed.ts`                                        |
| `npm run db:studio` | Open Prisma Studio to browse the database                   |

## Assumptions (Suppliers module)

- **Timezone/date formatting**: "Created On" is formatted server-side with a fixed
  `en-US`/`hour: numeric` + `MM/DD/YYYY` format (matching the design's own chip layout) so SSR
  and client output can't diverge into a hydration mismatch — no explicit business timezone
  was specified, so it renders in the server's local time.
- **Phone rule**: enforced exactly as specified — `^[0-9+\-\s]{5,32}$` — which allows digits,
  `+`, `-`, and spaces only; no country-code-aware formatting/validation.
- **Seed volume**: 25 suppliers at the default 10-per-page setting yields 3 pages, enough to
  exercise pagination, sorting, and search without being an unrealistic dataset size.
- **Supplier name isn't a link**: the design's `.ppl-cell .nm` style implies clickability
  (gold, hover-underline), but no supplier detail route exists in scope, so the name renders
  as styled text only — making it look clickable with nothing behind it felt worse than a
  plainly-styled label.
