# Annapurna Rebuilt — Production Deployment & Rollback Guide

## Architecture Compatibility
Annapurna Rebuilt is built on standard Next.js (App Router) and Prisma ORM, engineered specifically for zero-lock-in hosting on **Vercel** with a managed PostgreSQL instance (e.g. **Neon**, **Supabase**, or **AWS RDS**).

---

## 1. Managed PostgreSQL Setup (e.g. Neon / Supabase)
1. Provision a PostgreSQL 15+ database instance.
2. Ensure connection pooling is enabled if deploying on serverless architectures (Neon connection pooling `?pgbouncer=true` or Supabase Transaction mode on port 6543).
3. Copy the connection string into your environment:
   ```ini
   DATABASE_URL="postgres://user:password@ep-sample-pooler.region.neon.tech/neondb?sslmode=require"
   ```

---

## 2. Environment Variables Checklist
Configure the following environment variables in your Vercel Project Settings:

| Variable | Description | Required | Example |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Authoritative PostgreSQL connection string | **Yes** | `postgres://user:pass@host/db?sslmode=require` |
| `SESSION_SECRET` | 32+ character HMAC secret for session cookies | **Yes** | `f6a9e10...` (Use `openssl rand -hex 32`) |
| `NODE_ENV` | Runtime environment | **Yes** | `production` |
| `GEMINI_API_KEY` | Google Gemini API key for advisory assistance | Optional | `AIzaSy...` (Falls back to expert system if omitted) |

---

## 3. Database Migration Deployment
In your Vercel Build Settings, configure the build command to generate the Prisma client before bundling:
```bash
npm run build
```
*(Defined in `package.json` as `prisma generate && next build`)*.

For database migrations on production:
```bash
npm run db:migrate:deploy
```
*(Executes committed versioned Prisma migrations in `prisma/migrations/`)*.

To verify migration status:
```bash
npm run db:migrate:status
```

### 3.1 Initializing Essential Production Records
To provision essential administrative tenants and system settings non-destructively:
```bash
npm run db:init:essential
```
*(Safe and idempotent; never erases or truncates existing data)*.

### 3.2 Provisioning Production Administrator
Provision the initial production administrative user with strong credential policies (minimum 12 characters, uppercase, lowercase, numbers, and symbols):
```bash
ADMIN_EMAIL="admin@yourdomain.com" ADMIN_PASSWORD="YourStrongPassword123!" npm run admin:provision
```

> **Safety Notice:** Destructive reset scripts (`npm run db:reset:demo`) and demo fixture seeds (`npm run db:seed`) are protected by `assertSafeForDestructiveReset` and will refuse to execute in production or against non-local databases. Never run demo reset in production.

---

## 4. Zero-Downtime Rollback Strategy
If an issue is detected post-deployment:
1. **Instant Application Rollback:**
   - In the Vercel Dashboard, navigate to the **Deployments** tab.
   - Select the previous stable deployment and click **Promote to Production**. Rollback completes in < 5 seconds.
2. **Database Rollback:**
   - Schema modifications adhere to non-breaking expansion: columns added as optional (`?`) or with defaults before making required in subsequent releases.
   - Point-in-time recovery (PITR) is natively available on Neon/Supabase to rewind transactional state if needed.
