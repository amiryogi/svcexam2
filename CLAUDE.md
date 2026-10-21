# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Admin-only exam management app for a Nepali +2 school (Grades 11–12, NEB rules). It replaces an MS Access database. It is an npm-workspaces monorepo: `apps/api` (Express 5 + Prisma 6 + MySQL 8), `apps/web` (React 19 + Vite + Tailwind 4 + TanStack Query), and `packages/shared` (`@svi/shared`: Zod schemas, DTO types, NEB grading engine, used by both apps). [README.md](README.md) has the feature list, the NEB grading rules, and the Docker and cPanel+Vercel deployment steps.

## Commands

```bash
npm ci                              # install all workspaces; postinstall runs `prisma generate`
npm run dev:api                     # API on :4000 (tsx watch; needs apps/api/.env and MySQL)
npm run dev:web                     # web on :5173, proxies /api to API_TARGET or localhost:4000
npm run typecheck | lint | test | build   # what CI runs (.github/workflows/ci.yml)
node scripts/audit-prod.mjs         # CI's prod dependency audit (high+); reviewed advisories are listed in it
npm run import:marks -w @svi/api -- --file <xlsx> --year 2083 --exam "First Term"   # Excel marks import (+ --create-students), dry run unless --commit (README)
npm run build:deploy                # deploy/svi-api.zip for cPanel hosting (scripts/build-api-deploy.mjs)

# single test file / single test
npm test -w @svi/shared -- src/grading/engine.test.ts
npm test -w @svi/api -- src/pdf/html.test.ts -t "escapes"
npm test -w @svi/web                # web tests: pure logic only (e.g. pages/exams/markEntry.logic.ts)

# database (run in apps/api, or with -w @svi/api)
npm run db:generate -w @svi/api     # after editing prisma/schema.prisma
npm run db:migrate  -w @svi/api     # prisma migrate dev (local)
npm run db:deploy   -w @svi/api     # prisma migrate deploy
npm run db:seed && npm run create-admin
```

Use the workspace scripts, not bare `npx prisma`. Prisma is pinned to ~6.19, and `npx` can fetch an unrelated version.

Tests use Vitest and never touch a database. `apps/api/vitest.config.ts` sets a dummy `DATABASE_URL`, and `app.test.ts` only exercises middleware through supertest. Logic that needs testing goes in pure functions: the grading engine, `curriculum.logic.ts`, `marks/progress.logic.ts`, `importAccess.transform.ts`, the template helpers, and in the web app `markEntry.logic.ts` (autosave and conflict handling).

## How `@svi/shared` is resolved

`packages/shared/package.json` exports a custom `development` condition that points at `src/index.ts`. `tsconfig.base.json` (`customConditions`), the Vite config, the Vitest configs and the `tsx --conditions=development` scripts all use it. So dev, tests and typecheck read the shared **source** directly, with no build needed. Only the production API (`node dist/...`, deploy bundle, Docker) uses `packages/shared/dist`. `npm run build` therefore builds shared first.

## API architecture (`apps/api/src`)

- `app.ts` wires everything under `/api/v1`, in this order:
  1. rate limit;
  2. Origin check;
  3. `loadSession`;
  4. CSRF;
  5. `/auth` and `/public`;
  6. `requireAuth`;
  7. the feature routers.

  Each feature lives in `modules/<feature>/` as `*.routes.ts` plus an optional `*.service.ts`.
- Route pattern:
  1. `parse(sharedZodSchema, req.body | req.query | req.params)` (`lib/errors.ts`). It throws a 400 `VALIDATION_ERROR` with field paths, which the web forms map back onto inputs.
  2. Errors come from `badRequest` / `notFound` / `conflict` (an `AppError`).
  3. Mutations run in `prisma.$transaction(async (tx) => …)` and call `recordAudit(tx, ctxOf(req), {...})`. Every change is audited.
  4. Service functions take `db: Db` (a `PrismaClient` or a transaction client), so they work inside and outside transactions.
- Prisma `Decimal` columns are converted with `n()` / `num()` from `lib/prisma.ts` before they reach the DTOs in `packages/shared/src/types.ts`.
- Migrations are hand-written SQL in `prisma/migrations/<YYYYMMDDHHMMSS>_<name>/migration.sql`, using snake_case tables and columns (`@map`). New columns need a default so existing rows keep their current behaviour. Deployed servers apply them with `prisma migrate deploy`.

## Exams, marks and results (the core flow)

- **Exam lifecycle:** `DRAFT → MARK_ENTRY → PUBLISHED → LOCKED`. The generic status endpoint only does `EXAM_STATUS_TRANSITIONS`. Publish, unpublish and unlock have their own endpoints. Unpublish and unlock need a reason, and unlock is `SUPER_ADMIN` only.
- **Which components count:** a subject has TH (theory) and IN (internal) `SubjectComponent`s. `effectiveComponents()` in `modules/exams/exams.service.ts` is the **single source of truth** for which components an exam counts, with their full marks and pass percent. It applies:
  - the per-exam `ExamComponent` overrides;
  - the exam-level `includeInternal` flag. Terminal exams may be theory-only. `INTERNAL_REQUIRED_EXAM_TYPES` (SENDUP, FINAL) always include everything; see `examIncludesInternal()` in shared.

  Mark entry, progress, saving marks, results, ledgers and publishing all filter on its `included`, so change that rule there and nowhere else.
- **Grading:** `computeExamResults()` (`modules/results/results.service.ts`) builds `SubjectInput[]` from enrollments plus marks and calls the pure engine in `packages/shared/src/grading/engine.ts`. The engine does all arithmetic in integer hundredths, so values on a grade boundary never round down. NG in any component makes the subject NG, and the GPA is withheld on NG when the scale's `withholdGpaOnNg` is set. Grade scales are DB rows seeded from `grading/neb.ts`.
- **Publishing:** writes one immutable `ResultSnapshot` per enrollment (a JSON `GradeSheetData`). Published and locked exams read results from the snapshots, never live. The letterhead (school settings) and the exam print meta (`examMeta()`) are always re-read live, so print-detail corrections show on reprints. After publishing, only `EXAM_PRINT_FIELDS` may change. Any new field added to `GradeSheetData` must be optional, because old snapshots won't have it. Unpublishing moves the snapshots to `SupersededResultSnapshot` (with the reason) instead of deleting them, so every version that was handed out stays on record.
- **Marks:** saving uses optimistic locking through `Mark.version`. A stale version is returned as a conflict, not overwritten.

## PDFs and reports

- `modules/reports/reports.routes.ts` builds HTML report pages (`pdf/templates/gradesheet.ts`, `ledger.ts`). With `?as=html` it returns the page as JSON `{ filename, html }`, and the web app's `printReport()` prints it from a sandboxed iframe with the browser's print dialog. The production host (cPanel shared hosting) cannot run Chromium: its process limit is too low. Without `as=html`, the page is rendered to PDF with puppeteer-core and system Chrome/Edge (`pdf/browser.ts`, `CHROME_PATH`), with JavaScript and network requests disabled. That path works only where Chrome is installed (Docker, dev).
- Templates must print correctly from a browser too: rely on `@page` for size and margins, and keep `print-color-adjust: exact` so backgrounds print.
- Templates use the `html` tagged template from `pdf/html.ts`, which HTML-escapes every interpolation. Use `raw()` only for trusted constants such as CSS.
- The grade sheet layout copies the school's official `Format of grade sheet.pdf` in the repo root: every block is placed in mm as measured on that PDF (`@page` margin 0, footer pinned to the bottom, body rows shrink past 12 rows via `rowHeightMm()`). Check changes by printing the template to PDF and comparing word positions with the official PDF (pdfplumber), not by eye.
- Terminal exams may print A5 sheets instead (`Exam.sheetLayout`: `A5_GRADES` / `A5_MARKS`, see `examSheetLayout()`; send-up and final are always `OFFICIAL`). `gradeSheetsHtml()` hands them to `pdf/templates/resultSheetA5.ts`, which puts two per A4 landscape page; `marksSummary()` there computes the marks-only totals. Helpers shared by both templates live in `sheetHelpers.ts`.
- `?as=base64` returns a file (the Excel ledger) as JSON with base64 data, because Microsoft Edge blanks PDF bytes in fetched responses.

## Web architecture (`apps/web/src`)

- `api/client.ts` exposes `api<T>(path, {method, body, query})`. It adds the CSRF header, throws `ApiError` (with `.fieldErrors`), and also provides `openPdf` / `downloadFile`.
- Query keys live in `api/hooks.ts` (`qk`), alongside the ad-hoc keys used in pages, such as `['exam-components', id]`, `['exam-progress', id]` and `['results', id]`. After a mutation, invalidate every key whose data it affects.
- Forms use react-hook-form with `zodResolver(sharedSchema)` and `applyServerErrors` (`lib/forms.ts`). Shared UI primitives are in `components/ui.tsx`.
- B.S. ↔ A.D. date conversion uses `nepali-date-converter` (`lib/bsDate.ts`, plus an API equivalent).

## Repo conventions and gotchas

- TypeScript is strict with `noUncheckedIndexedAccess` and `verbatimModuleSyntax`. Use `import type` for type-only imports. API imports use `.js` extensions (ESM).
- Prettier: single quotes, semicolons, trailing commas, width 100.
- Line endings are mixed: some files are CRLF, others LF (`core.autocrlf=true`, no `.gitattributes`). Keep each file's existing endings when editing.
- Yearly Access imports follow the README runbook (`tools/import-access/export-accdb.ps1` → `import:access:check` → `dist/scripts/importAccess.js` on the server). Every Access file numbers students from 1. So students are matched by NEB registration number, and new ones get `SVI-<year>-<StuId>`. Never match students by `StuId` or admission number alone.
- **Live in production** with real student data:
  - API on NestNepal cPanel "Setup Node.js App" at `https://api.nevanhandicraft.com.np` (Passenger, `app.cjs`).
  - Web on Vercel, which deploys on a push to `main`. `apps/web/vercel.json` rewrites `/api/*` to the API.

  Keep migrations additive, with defaults that preserve current behaviour. The API is updated by hand:
  1. `npm run build:deploy`;
  2. upload and extract `deploy/svi-api.zip`;
  3. when `prisma/schema.prisma` changed, **Run NPM Install** (or `npx prisma generate` in the cPanel Terminal) so the server's Prisma client matches the schema;
  4. `npx prisma migrate deploy` in the cPanel Terminal;
  5. restart.
