1. See the actual limit (Terminal)

ulimit -u
ps -u nevanhan -o pid,nlwp,etime,args
ulimit -u prints the account's maximum number of processes and threads. Paste both outputs.

2. Free room. This is your decision about your other apps
Are gses and backend still used?

Not used: delete them in Setup Node.js App, then stop their processes:

pkill -u nevanhan -f "lsnode:/home/nevanhan/gses/"
pkill -u nevanhan -f "lsnode:/home/nevanhan/backend/"
Still used: click Restart on each in Setup Node.js App, so only one copy of each remains. Restarting won't stop the old copies; that has to be done by hand, which I can help with.
Then run the TMPDIR test from my last message again.

3. If it still fails, there are two ways out
Ask NestNepal to raise the limit: "Please increase the NPROC / number-of-processes limit for cPanel account nevanhan. My Node.js app needs to run headless Chromium for PDF generation." Many hosts do this on request, sometimes with a plan upgrade.
I change how grade sheets are printed: the server would send the grade sheet page, and your own browser prints it or saves it as PDF (Ctrl+P → Save as PDF), so no Chromium is needed on the server. The layout stays the same, because it's the same HTML that's rendered today. The trade-off is one extra click in the print dialog, and margins should be left at the default.
Whatever happens with printing, you can still use the Ledger Excel export now. It doesn't need Chromium.

In the meantime, add the TMPDIR variable to the app as described in step 2 of my last message. It's needed in every case except the browser-printing option.