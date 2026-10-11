What the README says, in plain terms
The README describes SVI +2 Exam Management, a website only school administrators use. It replaces the school's old MS Access exam database.

What it does: keeps Grade 11–12 student records, which subjects each student takes, exams, mark entry and NEB grade calculation. It prints grade sheets and mark ledgers as A4 PDFs, and keeps an audit log of every change.
Grading: follows NEB rules. A subject becomes NG if theory or internal marks fail, and the GPA is hidden if any subject is NG. Publishing an exam freezes its grade sheets so later edits can't change them. The README asks you to check the grading rules against the latest NEB directive before real use.
How it's built: a React frontend, a Node/Express backend, and a MySQL database.
Old data: an import tool brings the old Access database across. It was tested on the real file: 64 students and 768 marks.
Security: only signed-in admins can use it. Accounts lock after 5 wrong passwords, and sign-ins expire after 30 minutes idle or 12 hours.
Deployment: the README covers two options. Option 1 is your own VPS with Docker, which your plan can't do. Option 2 is cPanel hosting for the backend plus Vercel for the frontend, which is your setup and what the steps below follow.
Your deployment, step by step
I put Vercel before cPanel here. The server needs to know your Vercel web address, so it's easier to get that address first.

Part 1: Push the code to GitHub (on your PC)
The deployment changes I made aren't committed yet, and Vercel deploys from GitHub.

Commit and push to main on github.com/amiryogi/svcexam2. I can do this for you if you like.
The upload file is already built at F:\sviexamapp\deploy\svi-api.zip. If you change any backend code later, run npm run build:deploy again to rebuild it.
Part 2: Vercel (the frontend)
Sign in at vercel.com with your GitHub account.
Choose Add New → Project and import svcexam2.
Set Root Directory to apps/web. Leave everything else at the defaults, and don't add any environment variables.
Click Deploy.
When it finishes, write down your address, for example https://svcexam2.vercel.app. You'll need it in Part 3.
The login won't work yet, because the backend isn't set up.

Part 3: NestNepal cPanel (the backend)
Create the subdomain. Go to Domains → Create a New Domain and enter api.nevanhandicraft.com.np.

Turn on HTTPS. Go to SSL/TLS Status → Run AutoSSL and wait until api.nevanhandicraft.com.np shows a valid certificate.

Create the database in MySQL Databases:

Create a database, for example svi. cPanel adds your account prefix, so it becomes something like cpuser_svi.
Create a user, for example svi, which becomes cpuser_svi. To avoid URL-encoding trouble later, give it a password with only letters and numbers.
Under Add User To Database, choose that user and database and tick ALL PRIVILEGES.
Upload the app in File Manager:

In your home folder (not public_html), create the folder svi-api.
Open it, upload svi-api.zip, then right-click the zip and choose Extract.
Back in your home folder, also create the folder svi-storage. Uploaded logos are saved there.
Create the Node.js app. Go to Setup Node.js App → Create Application and fill in:

Node.js version: 22 or higher
Application mode: Production
Application root: svi-api
Application URL: api.nevanhandicraft.com.np
Application startup file: app.cjs
Environment variables (click Add Variable for each):
Name Value
NODE_ENV production
DATABASE_URL mysql://cpuser_svi:YourPassword@localhost:3306/cpuser_svi
APP_ORIGIN your Vercel address from Part 2, e.g. https://svcexam2.vercel.app (no / at the end)
COOKIE_SECURE true
TRUST_PROXY 2
STORAGE_DIR /home/cpuser/svi-storage (use your real cPanel username)
Click Create.

Install packages. On the app's page, click Run NPM Install and wait for it to finish. It can take a few minutes.

Set up the database. At the top of the app's page, copy the command that starts with source /home/.../activate && cd .... Open Terminal in cPanel, paste it, press Enter, then run these one at a time:

npx prisma migrate deploy
npm run db:seed:prod
npm run create-admin
The first creates the tables.
The second adds the grade scale, streams, Grade 11 subjects and curriculum.
The third asks for your admin username, full name and password.
Restart. Go back to Setup Node.js App and click Restart.

Test the backend. Open https://api.nevanhandicraft.com.np/api/v1/health in your browser. You should see {"status":"ok"}.

Part 4: Sign in and finish setup
Open your Vercel address and sign in with the admin account you just created.
Complete Setup: school details, logo, signatories, academic year, and the Grade 12 subjects.
Run three checks:
PDF: print a grade sheet and a ledger. This is the riskiest part on shared hosting.
Audit IP: open the Audit page. The IP next to your sign-in should be your real internet IP (search "what is my IP" to compare). If it's wrong, change TRUST_PROXY to 1 or 3 and click Restart.
Reload: press F5 on a page like Students. You should stay signed in.
Backups: turn on backups in cPanel (JetBackup, if NestNepal offers it), or download the database regularly from phpMyAdmin → Export.
If something goes wrong
Problem What to do
Health check fails Look at stderr.log in the svi-api folder. It's usually a wrong DATABASE_URL.
Login says "Cross-site request blocked" APP_ORIGIN doesn't exactly match the Vercel address. Fix it and click Restart.
PDF says "rendering failed to start" Check stderr.log. If it mentions a missing .so library, add CHROME_BUNDLED_LIBS=true and click Restart. If the process is being killed, ask NestNepal support to raise your account's memory and process limits.
Login fails on a Vercel preview link Expected. Only the main production address works.
Updating later
Frontend: push to GitHub and Vercel redeploys automatically.
Backend:
Run npm run build:deploy on your PC.
Upload the new svi-api.zip and extract it over the svi-api folder.
If dependencies changed, click Run NPM Install. If there are new migrations, run npx prisma migrate deploy in Terminal.
Click Restart.
