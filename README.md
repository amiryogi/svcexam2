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
- **Printing**: A4 grade sheets (one student, or a whole class at once) and a landscape mark ledger, printed through the browser's print dialog ("Save as PDF" makes the file), plus the ledger as Excel. Drafts print with a **PROVISIONAL** watermark.
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

The web app prints reports in the browser: the API sends the report page (`?as=html`) and the browser's print dialog makes the PDF. The API can still render PDFs itself for direct report links, using a locally installed Chrome, Chromium or Edge. Common install paths are detected automatically; otherwise set `CHROME_PATH` in `apps/api/.env`.

Quality checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## Importing the old Access database

Each academic year's results live in their own Access file (e.g. `Final Exam XI (2081).accdb`) with the tables `StudentDetails`, `NEB_Details`, `Subject` and `Scores`. Import one file per year as follows.

**[tools/import-access/IMPORT-GUIDE.md](tools/import-access/IMPORT-GUIDE.md)** is the detailed step-by-step version for the live cPanel server, with what to look for in each output and fixes for common errors. The summary:

**On a Windows PC** (with Access or the Access Database Engine installed):

1. Export the tables. The `.accdb` is opened **read-only**. This writes four CSV files and `svi-import.zip` to `tools/import-access/out/`:
   ```powershell
   powershell -ExecutionPolicy Bypass -File tools\import-access\export-accdb.ps1 -Database ".\Final Exam XI (2081).accdb"
   ```
2. Check the data. This needs no database: it prints counts, missing dates and numbers, and every warning.
   ```bash
   npm run import:access:check -w @svi/api -- --dir ../../tools/import-access/out --year 2081
   ```

**On the server** (cPanel):

3. In File Manager, create `svi-import` in the home folder (**not** in `public_html`), empty it if it already exists, then upload and extract `svi-import.zip` into it.
4. In Terminal, run the dry run. It imports everything inside a transaction, prints a summary, then rolls back:
   ```bash
   source /home/<cpuser>/nodevenv/svi-api/24/bin/activate && cd /home/<cpuser>/svi-api
   node dist/scripts/importAccess.js --dir /home/<cpuser>/svi-import --year 2081 --grade 11 --exam Final --dry-run
   ```
   If the summary looks right, run the same command without `--dry-run`.
   - Locally, against a development database, use `npm run import:access -w @svi/api -- …` with the same options instead.
   - `--exam-year-bs` / `--exam-year-ad` are optional: by default, grade sheets print the academic year as the year the exam was conducted. Either way, it can be changed later under the exam's **Edit**.

**In the app:**

5. Open the imported exam, set the date of issue, and compare a few grade sheets with the paper ones. Then click **Publish results**.
6. Delete the CSV files and the zip, on the server (`svi-import`) and on the PC (`tools/import-access/out`). They contain student personal data.

**How records are matched and fixed:**

- **Admission numbers:** new students get `SVI-<year>-<Access StuId>`, e.g. `SVI-2081-0001`, because every yearly file numbers students from 1. Override this with `--admission-prefix`.
- **Existing students:** they are found by NEB registration number first, then by admission number, and keep their admission number. If an admission number already belongs to a student with a different registration number, the import stops and saves nothing.
- **Re-running:** the import is idempotent. Re-running it updates the existing records instead of creating duplicates.
- **Data clean-up:**
  - Surnames stored in `MiddleName` are moved to the last name.
  - B.S. dates stored as `m/d/yyyy` text or in Access Date fields are both read.
  - The A.D. date is recalculated from the B.S. date.
  - Students already enrolled in the same grade in another year stop the import, because that usually means last year's files were uploaded. Real repeaters are let through with `--allow-repeaters`.
  - Every subject combination is checked against the curriculum. If a student's subjects don't fit their recorded stream but fit exactly one other stream, that stream is used, and the dry run lists each correction (Access files often record the wrong stream).

**Verified on real files:** the 2083 Grade XI file imported 64 students and 768 marks with no warnings. 63 of 64 GPAs are identical to the Access calculation. The exception is student 3 (0/50 in Computer Science theory), who Access wrongly graded "C" and who is now correctly NG with the GPA withheld.

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

## Deployment (cPanel Node.js hosting + Vercel)

The API runs on cPanel hosting with **Setup Node.js App** and **Terminal** (here NestNepal, at `https://api.nevanhandicraft.com.np`). The web app runs on Vercel. Vercel forwards `/api/*` to the API ([apps/web/vercel.json](apps/web/vercel.json)), so the browser only ever talks to the Vercel address. The session cookie, CSRF check and logo images therefore work exactly as they do behind Nginx, and no CORS is needed.

### API (cPanel)

1. **Build the bundle** on your PC: `npm run build:deploy`. This creates `deploy/svi-api.zip`, which contains the compiled API, Prisma migrations, `@svi/shared`, a lockfile and `app.cjs` (the Passenger startup file).
2. **Subdomain:** in cPanel, go to *Domains*, create `api.nevanhandicraft.com.np`, and run *SSL/TLS Status → Run AutoSSL*.
3. **Database:** in *MySQL Databases*, create a database and a user, and add the user to the database with ALL PRIVILEGES. The real names carry your cPanel prefix, e.g. `cpuser_svi`.
4. **Upload:** in *File Manager*, create `/home/<cpuser>/svi-api` (outside `public_html`), upload `svi-api.zip` there and extract it. Also create `/home/<cpuser>/svi-storage`, where uploaded logos are stored.
5. **Setup Node.js App → Create Application:**
   - Node.js version: **22** or newer
   - Application mode: Production
   - Application root: `svi-api`
   - Application URL: `api.nevanhandicraft.com.np`
   - Application startup file: `app.cjs`
   - Environment variables:

   | Name | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | `mysql://cpuser_svi:PASSWORD@localhost:3306/cpuser_svi` (URL-encode special characters in the password) |
   | `APP_ORIGIN` | `https://<project>.vercel.app`, the exact Vercel production URL with no trailing slash |
   | `COOKIE_SECURE` | `true` |
   | `TRUST_PROXY` | `2` (Vercel, then the web server; see the check below) |
   | `STORAGE_DIR` | `/home/<cpuser>/svi-storage` |

6. Click **Run NPM Install**. Then open **Terminal**, paste the `source …/activate && cd …` command shown at the top of the app page, and run:
   ```bash
   npx prisma migrate deploy
   npm run db:seed:prod
   npm run create-admin
   ```
7. **Restart** the app. `https://api.nevanhandicraft.com.np/api/v1/health` should return `{"status":"ok"}`.

**Printing:** grade sheets and ledgers are printed by the user's browser, so the server never runs Chrome. Shared hosting's process limit (about 100 threads per account on NestNepal, shared by all of the account's Node apps) is too low for headless Chromium, which needs about 50 threads. Direct PDF links to the API therefore fail there with "PDF rendering is not configured".

**Shared-hosting gotchas we hit:**
- Imunify360 bot-protection can block requests coming through Vercel's proxy with a 403 `Access denied by Imunify360 bot-protection`. Ask the host to disable it for the API subdomain.
- If cPanel Terminal or Setup Node.js App fail with `Resource temporarily unavailable`, the account is at its process limit. `kill -9 -1` in Terminal (a shell built-in, so it still works) ends all of the account's processes, and the Node apps restart on their next request.

### Web app (Vercel)

1. On Vercel, choose *Add New → Project*, import this Git repository and set **Root Directory** to `apps/web`. The Vite preset, `npm run build` and the `dist` output are the defaults. No environment variables are needed.
2. Deploy, then copy the production URL into `APP_ORIGIN` on the server and restart the Node app.
3. Sign in and complete **Setup** as in step 5 of the Docker section.

Logins only work on the production URL. Vercel preview deployments have other addresses, so the API's Origin check rejects them. If you later add a custom domain on Vercel, change `APP_ORIGIN` to match it.

### Checks after the first deploy

- Open the **Audit** page and check that the IP address on your own sign-in is your real public IP. If it shows a Vercel or `127.0.0.1` address, change `TRUST_PROXY` (try `1` or `3`) and restart. The login rate limiter depends on this IP.
- Print a grade sheet and a ledger. Reload a deep link such as `/students` and check that you're still signed in.
- Backups: turn on the host's database backups (e.g. JetBackup in cPanel), or download a copy regularly from *phpMyAdmin → Export*.

### Updating

- **Web:** push to the Git branch Vercel deploys from.
- **API:** run `npm run build:deploy`, upload `svi-api.zip` and extract it over `svi-api` (this overwrites `dist/` and `prisma/`). Click **Run NPM Install** if dependencies changed, run `npx prisma migrate deploy` in Terminal if there are new migrations, then click **Restart**.
- Very large class-wide prints can hit Vercel's proxy timeout. If one fails with a 504 error, print by stream or section.

## Security summary

- **Admin-only.** Every API route except login requires a session. The only other public routes are `/api/v1/public/branding` and `/api/v1/public/logo`. They return just the school name, address and logo (already printed on every grade sheet), so the login page can show them. Roles are `SUPER_ADMIN` (manages users, can unlock exams) and `ADMIN`.
- **Passwords:** argon2id with OWASP parameters, a minimum of 10 characters with mixed case and digits. No default password exists. Changing a password signs out the account's other sessions.
- **Sessions:** a random 256-bit token in an `HttpOnly; Secure; SameSite=Strict` cookie (`__Host-` prefix in production). Only its SHA-256 hash is stored. Timeouts are 30 minutes idle and 12 hours absolute.
- **CSRF:** a synchronizer token (`X-CSRF-Token`), plus Origin/Referer checks, plus SameSite=Strict.
- **Login protection:** per-IP+username rate limiting, and the account locks after 5 failures for 15 minutes. Error messages are generic, and response times are the same for unknown and known usernames.
- **Validation:** every input is validated with Zod and all queries are parameterised (Prisma). Every value in PDF templates is HTML-escaped. Uploaded logos are checked by magic bytes.
- **Report printing:** the web app loads report pages into a sandboxed iframe that cannot run scripts. Server-side PDF rendering (where Chrome is installed) runs Chromium with JavaScript disabled and every network request blocked.
- **Headers and logs:** Helmet with `default-src 'none'` on the API and a strict CSP on the SPA. Logs (pino) redact cookies and CSRF tokens.

**Planned next:** TOTP two-factor login for admins, and a Playwright end-to-end suite in CI.
