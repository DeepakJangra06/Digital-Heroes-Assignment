# Digital Heroes - Full Stack Assessment

PRD-aligned web platform with:
- subscription plans (monthly/yearly)
- score management (Stableford, latest 5 only)
- monthly draw engine (random/algorithmic + simulation/publish)
- charity selection and contribution tracking
- winner proof and payout workflow
- role-based panels (`USER` + `ADMIN`)

## Tech Stack
- Next.js 16 (App Router, server actions)
- Prisma + Supabase Postgres
- Tailwind CSS
- Cookie-based JWT auth

## Local / Supabase Setup
1. Install dependencies:
   - `npm install`
2. Create environment file:
   - `Copy-Item .env.example .env`
3. Put your **new Supabase** connection string into `DATABASE_URL`.
4. Generate Prisma client and database:
   - `npm run prisma:generate`
   - `npm run db:push`
   - `npm run db:seed`
5. Start app:
   - `npm run dev`
6. Open:
   - [http://localhost:3000](http://localhost:3000)

## Default Credentials
- Admin:
  - Email: `admin@digitalheroes.dev`
  - Password: `Admin@123`

## Key PRD Behaviors Implemented
- Only one score allowed per date per user.
- New scores auto-trim to latest 5 scores.
- Draw tiers: 5, 4, and 3 matches.
- Prize split enforced at 40% / 35% / 25%.
- Admin can run simulation or published draw.
- Winners can upload proof screenshots.
- Admin verifies winners and marks payout state.
- Subscription lifecycle includes active, lapsed, cancelled.
- Independent donations supported outside subscription gameplay.
- Email notification pipeline implemented via SMTP (with in-app notification fallback).

## Deploy (Vercel + Supabase recommendation)
1. Create a **new Supabase project** and copy its Postgres URI.
2. Create a **new Vercel account/project** and connect this repository.
3. Set Vercel environment variables:
   - `DATABASE_URL`
   - `JWT_SECRET`
4. After first deploy, run against the same DB:
   - `npx prisma db push`
   - `npm run db:seed`
5. Validate production:
   - Signup as user
   - Admin login
   - Score entry and 5-score rolling logic
   - Run draw (simulation + publish)
   - Winner proof and payout status update

## Submission-Only Checklist
- Live URL (Vercel)
- User credentials
- Admin credentials
- Confirmation that new Vercel and new Supabase accounts were used

## Validation Commands
- `npm run lint`
- `npm run build`
