# SVI +2 Exam Management

An admin-only web application for **Siddhartha Vanasthali Institute** that replaces the old MS Access
exam database (`StudentsDBforwebsite.accdb`). It manages Grade 11–12 (NEB) students, subject
enrollment, terminal/final exams, mark entry, results and A4 grade-sheet printing.

| Layer    | Technology |
|----------|------------|
| Frontend | React 19 · Vite · Tailwind CSS 4 · React Router · TanStack Query · React Hook Form |
| Backend  | Node 24 · Express 5 · Prisma 6 · Zod 4 · argon2 · Puppeteer (PDF) · ExcelJS |
| Database | MySQL 8.4 |
| Shared   | `@svi/shared` – Zod schemas, types and the NEB grading engine used by both sides |
| Language | TypeScript everywhere (strict) |

## Features

- **Students**: create, edit, search, soft-delete/restore, CSV import. Dates of birth in B.S. and A.D. are converted automatically and checked against each other.
- **Enrollment**: academic year → grade → stream → section/roll/symbol no. Subjects are chosen from **curriculum groups** (e.g. "Compulsory", "Social Studies / Mathematics", "Optional III"), and the API enforces the minimum and maximum per group. There is also a bulk symbol-number editor, a Grade XI → XII promotion that maps subjects by family code (only students who passed the published Grade XI Final move up), and a "Mark XII passed out" step that sets students who passed the Grade XII Final to *Passed out*. Academic years are named by their 4-digit B.S. year (e.g. `2084`).
- **Exams**: any number of exams per year and grade (First Terminal, Send-up, Final …). An exam moves through `Draft → Mark entry → Published → Locked`. Full marks can be overridden per exam, and a component can be left out (e.g. a terminal exam with no internal marks).
- **Mark entry**: a spreadsheet-style grid with keyboard navigation (Enter / ↑ / ↓) and Present/Absent/Withheld status.
  - Shows a live grade for each mark and validates it against the full mark.
  - Saves automatically after you stop typing.
  - Uses optimistic locking: if two people edit the same cell, the second save is reported as a conflict instead of overwriting.
- **Results**: computed live with the NEB rules. **Publishing freezes each student's grade sheet** as a snapshot, so later edits to names, subjects or the grade scale cannot change grade sheets that were already issued.
- **Printing**: server-rendered A4 PDFs (one student, or a whole class in one file), plus a mark ledger as PDF (landscape) or Excel. Drafts print with a **PROVISIONAL** watermark.
- **Setup**: school details and logo, signatories, academic years, streams, subjects (NEB codes, credit hours, full marks), curriculum groups, grade scale, and administrator accounts.
- **Audit log**: every change, sign-in, publish and print, with before/after values.

## NEB grading rules

The defaults live in [packages/shared/src/grading/neb.ts](packages/shared/src/grading/neb.ts) and are seeded into the database. They can be edited under **Setup → Grade scale** without changing any code.

1. **Component grade**: the theory (TH) and internal (IN) components are each graded on their percentage. ≥90 A+ 4.0, ≥80 A 3.6, ≥70 B+ 3.2, ≥60 B 2.8, ≥50 C+ 2.4, ≥40 C 2.0, ≥35 D 1.6, otherwise **NG**. The pass percentage is stored per component (35% by default).
2. **NG rule**: if TH **or** IN is NG, absent or withheld, the whole subject is **NG**.
3. **Subject final grade point**: (GP<sub>TH</sub>×CH<sub>TH</sub> + GP<sub>IN</sub>×CH<sub>IN</sub>) / CH. It is mapped with NEB's "above X" table: >3.6 A+, >3.2 A, >2.8 B+, >2.4 B, >2.0 C+, >1.6 C, =1.6 D.
4. **GPA**: Σ(CH×GP) / ΣCH, to 2 decimals. It is **withheld ("—") when any subject is NG**. This is a setting.
5. All arithmetic is done in integer hundredths, so values that land exactly on a boundary can't round down by mistake (e.g. 2.8 computed as 2.7999999999999996).

> ⚠️ Before production use, check the scale, the final-grade table and the GPA-withholding rule against the latest NEB directive.

## Repository layout

```
apps/api            Express API (Prisma schema & migrations in apps/api/prisma)
apps/web            React SPA
packages/shared     Zod schemas, DTO types, grading engine (+ tests)
tools/import-access PowerShell exporter for the old Access database
docker/             Dockerfiles, Nginx config, backup script
```

## Local development

Requirements: Node 24+, and either Docker (for MySQL) or a local MySQL 8.4.

```bash
npm install                       # installs all workspaces, generates the Prisma client
docker compose up -d              # MySQL on 127.0.0.1:3306 (or use your own MySQL)
cp apps/api/.env.example apps/api/.env
npm run db:deploy -w @svi/api     # apply migrations
npm run db:seed                   # grade scale, streams, Grade 11 subjects, curriculum
npm run create-admin              # interactive; there is no default password
npm run dev:api                   # http://localhost:4000
npm run dev:web                   # http://localhost:5173 (proxies /api to the API)
```

PDF rendering uses a locally installed Chrome, Chromium or Edge. Common install paths are detected automatically; otherwise set `CHROME_PATH` in `apps/api/.env`.

Quality checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## Importing the old Access database

1. On Windows (with Access or the Access Database Engine installed), export the tables to CSV. The `.accdb` is opened **read-only**.
   ```powershell
   powershell -ExecutionPolicy Bypass -File tools\import-access\export-accdb.ps1 -Database .\StudentsDBforwebsite.accdb
   ```
2. Import into MySQL. Run it as a dry run first: it imports everything inside a transaction, prints a summary and then rolls back.
   ```bash
   npm run import:access -w @svi/api -- --dir ../../tools/import-access/out \
     --year 2081 --grade 11 --exam Final --exam-year-bs 2081 --exam-year-ad 2024 --dry-run
   # then without --dry-run, adding --publish to freeze the grade sheets
   ```
   The importer fixes problems in the old data:
   - Surnames stored in `MiddleName` are moved to the last name.
   - `m/d/yyyy` B.S. dates are normalised.
   - Every subject combination is checked against the curriculum.

   It is idempotent, so re-running it updates instead of duplicating.

   **Verified on the real file:** 64 students and 768 marks imported with no warnings. 63 of 64 GPAs are identical to the Access calculation. The exception is student 3 (0/50 in Computer Science theory), who Access wrongly graded "C" and who is now correctly NG with the GPA withheld.

> The CSV files contain student personal data. They are git-ignored; delete them after the import.

## Deployment (Linux VPS with Docker)

1. Point a DNS record (e.g. `exam.school.edu.np`) at the server and open ports 80 and 443.
2. `cp .env.example .env`, then fill in `DOMAIN`, the database passwords and `BACKUP_PASSPHRASE`. Use long random values.
3. Get the first TLS certificate (Nginx needs it before it can start):
   ```bash
   docker compose -f docker-compose.prod.yml run --rm -p 80:80 --entrypoint certbot certbot \
     certonly --standalone -d "$DOMAIN" --agree-tos -m admin@your-school.edu.np
   ```
4. Start the stack, then seed the database and create the first admin:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   docker compose -f docker-compose.prod.yml exec api node dist/scripts/seed.js
   docker compose -f docker-compose.prod.yml exec api node dist/scripts/createAdmin.js
   ```
5. Sign in at `https://$DOMAIN`, then complete **Setup**: school details, logo, signatories, academic year, and the Grade 12 subjects.

**What runs:**
- `mysql`: internal network only, never published to the host.
- `api`: runs migrations on start, includes a health check, and runs as a non-root user.
- `web`: Nginx serving the SPA with TLS, HSTS and a strict CSP, and proxying `/api`.
- `certbot`: renews certificates every 12 hours.
- `backup`: a nightly encrypted `mysqldump` to `./backups`, kept for 30 days. Copy `./backups` off the server (rclone, S3 …) and test a restore regularly. The restore command is at the top of [docker/backup/backup.sh](docker/backup/backup.sh).

**Scaling:** sessions are stored in MySQL, so the API is stateless and can be scaled with `--scale api=N` behind Nginx. The per-IP rate limiter is in-memory per replica, while account lockout is stored in the database and so applies across all replicas. If bulk PDF exports grow, move them to a job queue.

## Security summary

- **Admin-only.** Every API route except login requires a session. The only other public routes are `/api/v1/public/branding` and `/api/v1/public/logo`. They return just the school name, address and logo (already printed on every grade sheet), so the login page can show them. Roles are `SUPER_ADMIN` (manages users, can unlock exams) and `ADMIN`.
- **Passwords:** argon2id with OWASP parameters, a minimum of 10 characters with mixed case and digits. No default password exists. Changing a password signs out the account's other sessions.
- **Sessions:** a random 256-bit token in an `HttpOnly; Secure; SameSite=Strict` cookie (`__Host-` prefix in production). Only its SHA-256 hash is stored. Timeouts are 30 minutes idle and 12 hours absolute.
- **CSRF:** a synchronizer token (`X-CSRF-Token`), plus Origin/Referer checks, plus SameSite=Strict.
- **Login protection:** per-IP+username rate limiting, and the account locks after 5 failures for 15 minutes. Error messages are generic, and response times are the same for unknown and known usernames.
- **Validation:** every input is validated with Zod and all queries are parameterised (Prisma). Every value in PDF templates is HTML-escaped. Uploaded logos are checked by magic bytes.
- **PDF rendering:** Chromium runs with JavaScript disabled and every network request blocked.
- **Headers and logs:** Helmet with `default-src 'none'` on the API and a strict CSP on the SPA. Logs (pino) redact cookies and CSRF tokens.

**Planned next:** TOTP two-factor login for admins, and a Playwright end-to-end suite in CI.
