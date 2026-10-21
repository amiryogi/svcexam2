# Importing an old Access file into the live app

Use this guide once for each Access file, for example `Final Exam XI (2081).accdb`. Each file holds one batch: one academic year, one grade, the Final exam.

It takes about 20 minutes. Nothing is saved to the live database until **step 9**, and before that a **dry run** (step 8) shows exactly what would happen.

| Where | What you use |
|---|---|
| **This PC** | PowerShell, in the folder `D:\svcexam\svcexam2` |
| **Server** | cPanel → **File Manager** and **Terminal** |
| **App** | the website, signed in as an admin |

> **Student data warning:** the CSV and zip files contain students' personal data. Never put them in `public_html`, and delete them at the end (step 14).

---

## Before you start (one time only)

- This PC has the project in `D:\svcexam\svcexam2`, and `npm ci` has been run there once.
- Microsoft Access, or the free *Microsoft Access Database Engine*, is installed. It's needed to read `.accdb` files.
- You know the batch's **academic year**: the B.S. year its session **started** (e.g. `2081` for the 2081/82 session, whose Final was held in 2082; add `--exam-year-bs 2082` so grade sheets print that year), and its **grade** (`11` or `12`).

---

## Part A: On this PC

**1. Put the Access file in the project folder**

Copy the `.accdb` file into `D:\svcexam\svcexam2`.

**2. Empty the export folder**

Open `D:\svcexam\svcexam2\tools\import-access\out` in File Explorer and delete everything in it. This makes sure no files from an earlier year get uploaded by mistake.

**3. Export the tables**

Open PowerShell in `D:\svcexam\svcexam2`, and run this with your file's name between the quotes:
```powershell
powershell -ExecutionPolicy Bypass -File tools\import-access\export-accdb.ps1 -Database ".\Final Exam XI (2081).accdb"
```
It lists the four tables with their row counts and creates `tools\import-access\out\svi-import.zip`. The Access file is only read, never changed.

**4. Check the data**

Put the batch's academic year after `--year`:
```powershell
npm run import:access:check -w @svi/api -- --dir ../../tools/import-access/out --year 2081
```
Read the output:

| Line | What it should show |
|---|---|
| `Students … marks …` | The number of students you expect. Marks = students × 6 subjects × 2 (theory + internal). |
| `By stream` | Don't worry if it looks wrong: the import corrects each student's stream from their subjects. |
| `Missing: …` | Ideally all `0`. Missing dates of birth or NEB numbers leave blanks on the grade sheets, so fix them in Access first if you can, then repeat from step 3. |
| `First student` | A real name from this batch, with an admission number like `SVI-2081-00..`. |
| `warning(s)` | Ideally `0`. Read any warnings: they name the student and the problem. |

---

## Part B: On the server

**5. Upload the zip**

1. cPanel → **File Manager** → your home folder (`/home/nevanhan`, the same level as `svi-api`).
2. Open the **`svi-import`** folder. If it doesn't exist, click **+ Folder** and create it.
3. If there are files inside, **Select All** → **Delete**. The folder must be empty.
4. Click **Upload** and choose `D:\svcexam\svcexam2\tools\import-access\out\svi-import.zip`.
5. Back in `svi-import`, right-click the zip → **Extract** → **Extract File(s)**. You should now see `StudentDetails.csv`, `NEB_Details.csv`, `Subject.csv` and `Scores.csv`.

**6. Open the Terminal**

cPanel → **Terminal**, then run:
```bash
source /home/nevanhan/nodevenv/svi-api/24/bin/activate && cd /home/nevanhan/svi-api
```

**7. Make sure it's the right file**
```bash
wc -l /home/nevanhan/svi-import/StudentDetails.csv
```
The number must be **your student count + 1** (the extra line is the header row). If it isn't, the old files are still there: go back to step 5.

**8. Dry run (saves nothing)**

Change `--year` (and `--grade 12` for a Grade XII file):
```bash
node dist/scripts/importAccess.js --dir /home/nevanhan/svi-import --year 2081 --grade 11 --exam Final --dry-run
```
Read the output:

| Line | What it means |
|---|---|
| `Read N students` / `Imported N students, M marks` | N and M must match step 4. |
| `Stream corrected for … student(s)` | Students whose Access stream didn't match their subjects (Physics/Chemistry/Biology → Science; Accounting/Economics → Management). This is expected. |
| `Outcomes: { PASS, NG, INCOMPLETE }` | How many pass or fail. Note the NG count for step 11. |
| five student lines with GPAs | Compare one or two with the paper grade sheets. |
| `warning(s)` | Read them; each names the student and the problem. |
| `Dry run: all changes rolled back.` | **Must be the last line.** Nothing was saved. |

If you get an error instead, see **Troubleshooting** below.

**9. Real import**

Run the same command **without** `--dry-run`:
```bash
node dist/scripts/importAccess.js --dir /home/nevanhan/svi-import --year 2081 --grade 11 --exam Final
```
It prints the same lines, without "Dry run: all changes rolled back". If anything fails, nothing is saved, and you can simply run it again once the problem is fixed.

---

## Part C: In the app

**10. Check the students**

Open **Students**: the total should have gone up by the number of students imported. New students have admission numbers `SVI-<year>-0001`, `SVI-<year>-0002` and so on.

**11. Check the NG students before publishing**

Open **Exams** → **Final** (the right grade and year) → **Results & grade sheets**, and look at every NG student.
- Compare their marks with the school's paper records (mark ledger, teachers' internal registers).
- If a mark was mistyped in Access, correct it in **Mark entry**, using the real mark from the records.
- If a student didn't sit an exam, set **Absent** instead of 0.
- Only enter marks that are in the school's records. Grade sheets are official documents.

**12. Print details**

On the exam page, click **Edit**:
- **Date of issue (B.S.)**: as on the paper grade sheets.
- **Conducted in (B.S. / A.D. year)**: leave blank to use the academic year, or fill it in if the paper sheets show a different year.

**13. Check and publish**

Print a few grade sheets and compare them line by line with the paper ones: codes, credit hours, grades, final grade and GPA. They show a **PROVISIONAL** watermark until published; that's normal. When everything matches, click **Publish results**.

---

## Part D: Clean up

**14. Delete the student data files**
- Server: File Manager → delete the **`svi-import`** folder.
- This PC: delete everything in `D:\svcexam\svcexam2\tools\import-access\out`.
- Keep the `.accdb` file somewhere safe (it isn't uploaded to GitHub).

---

## Troubleshooting

| Message | What to do |
|---|---|
| `fork: Resource temporarily unavailable`, `EAGAIN`, or `pthread_create` | The hosting account has run out of processes. Run `ps -u nevanhan -o pid,nlwp,etime,args`. Stop leftover copies of apps you have deleted with `kill <PID>`, or restart apps that appear twice in **Setup Node.js App**. Then try again. If it keeps happening, ask NestNepal to raise the account's process (NPROC) limit. |
| `… student(s) in these files are already enrolled in Grade 11 in another year` | Usually the **wrong files** are in `svi-import`, e.g. last year's. Redo step 5 with the right zip. If these students really repeated the grade, add `--allow-repeaters` to the command. Nothing was saved either way. |
| `… would get admission number SVI-…, which already belongs to …` | Two different students would get the same admission number. Add `--admission-prefix SVI-2081B-` (any unused prefix) to the command. |
| `Subjects missing in the database: …` | The file uses a subject code the app doesn't have yet. Add the subject under **Setup → Subjects**, or ask your developer. |
| `Exam "Final" is PUBLISHED; unpublish it before re-importing` | That exam was already imported and published. Only re-import if you mean to replace it: open the exam, **Unpublish** (give a reason), then run the import again. |
| Student count or names in the dry run belong to another year | Old files are still in `svi-import`. Redo step 5. |
| `Cannot find module` / `dist/scripts/importAccess.js` not found | The API files on the server are incomplete. Upload and extract `svi-api.zip` again (see below). |

**Running the import again is safe** until you publish. It updates the same students, enrollments and marks instead of creating duplicates.

---

## Only when the app itself has been updated

This is **not** needed for every import, only when your developer tells you the API changed.

1. On this PC: `npm run build:deploy`. This creates `D:\svcexam\svcexam2\deploy\svi-api.zip`.
2. File Manager → `svi-api` → upload that zip → **Extract**, and overwrite if asked.
3. If your developer says there are database changes: in Terminal (step 6), run `npx prisma migrate deploy`, then `npx prisma generate`.
4. **Setup Node.js App** → **Restart** `svi-api`, then check that `https://api.nevanhandicraft.com.np/api/v1/health` shows `{"status":"ok"}`.
