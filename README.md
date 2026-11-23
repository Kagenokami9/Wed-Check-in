# BLUE CHECK-IN (`สีฟ้าเช็คชื่อกันน`)

Web-based classroom attendance tracking application for **Blue House (คณะสีฟ้า)** built with **Next.js 15 App Router**, **TypeScript**, **Tailwind CSS v4**, **shadcn/ui**, and **Supabase PostgreSQL**.

## Key Features

- **Attendance Workflow:** Fast mobile-first classroom check-in (`มา`, `สาย`, `ไม่มา`, `อื่นๆ` + optional note), calendar date picker, optimistic concurrency conflict guard, student nickname management, history search, Recharts summary analytics, and UTF-8 BOM CSV export for Thai Excel.
- **Zero-Exposure BFF Security:** All database operations run exclusively through Next.js server-side API Route Handlers (`/api/*`, guarded by `import "server-only"`). PostgreSQL enforces `FORCE ROW LEVEL SECURITY` and revokes all `PUBLIC`, `anon`, and `authenticated` privileges.
- **2-Tier PIN + Owner Recovery RBAC:**
  - **Member (Staff):** Daily/historical attendance check-in, nicknames, history, summary, and CSV export.
  - **Admin (`/admin`):** Roster CRUD (rooms & students), PIN rotation with immediate session revocation, append-only Audit Log viewer, manual Snapshots, and HMAC-SHA256 signed off-site JSON backup export.
  - **Owner Recovery:** Env-only `OWNER_RECOVERY_KEY_HASH` (`scrypt`) for emergency PIN reset and atomic full-system snapshot/backup restore.
- **Fail-Closed Architecture:** Returns HTTP `503` if required server environment variables or database connectivity are unavailable—never silently falls back to browser `localStorage`.

## Local Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Generate `.env.local` from template:
   ```bash
   cp .env.example .env.local
   ```
   Or run the helper script to generate random `SESSION_SECRET` and `OWNER_RECOVERY_KEY_HASH`:
   ```bash
   node scripts/init-env-local.mjs
   ```
3. Fill in your server-only Supabase credentials in `.env.local` (never prefix secrets with `NEXT_PUBLIC_`).
4. Start the development server:
   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev` — Start local Next.js dev server
- `npm run build` — Create production build
- `npm run typecheck` — Run strict TypeScript check (`tsc --noEmit`)
- `npm run lint` — Run ESLint
- `npm test` — Run security crypto unit tests (`scrypt`, HMAC session tokens, signed backup verification)
- `npm run sync:roster` — Parse local `student-list-2569.md` into `src/data/roster.json` (gitignored)
- `npm run seed:supabase` — Non-destructively upsert rooms & students from local `src/data/roster.json` into Supabase

## Production Deployment (Vercel)

Set the following **Server-Only Environment Variables** in Vercel Project Settings:

| Variable | Description |
| :--- | :--- |
| `SUPABASE_URL` | Supabase project URL (`https://<project-ref>.supabase.co`) |
| `SUPABASE_SECRET_KEY` | Supabase server-only secret key (`sb_secret_...`) |
| `SESSION_SECRET` | Random 64-char hex secret for HMAC-SHA256 session cookies & signed backups |
| `OWNER_RECOVERY_KEY_HASH` | Salted `scrypt` hash (`scrypt$<salt>$<hash>`) generated via `node scripts/hash-secret.mjs` |

After deploying, verify `GET /api/health` returns `200 OK` and consider scheduling a daily keep-alive check on `/api/health` if running on Supabase Free Tier.
