/**
 * Checks exported Access CSVs before uploading them; needs no database or .env.
 *
 *   npm run import:access:check -w @svi/api -- --dir ../../tools/import-access/out --year 2081
 *
 * Prints what importAccess.ts would import (counts, missing details, a sample student) and every
 * warning, so data problems surface before the server dry run.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { transformAccess } from './importAccess.transform.js';

const { values: args } = parseArgs({
  options: {
    dir: { type: 'string', default: '../../tools/import-access/out' },
    year: { type: 'string' },
    'admission-prefix': { type: 'string' },
  },
});

const dir = path.resolve(args.dir!);
const read = (f: string) => readFile(path.join(dir, f), 'utf8');
const prefix = args['admission-prefix'] ?? (args.year ? `SVI-${args.year}-` : 'SVI-<year>-');
const data = transformAccess(
  {
    studentDetails: await read('StudentDetails.csv'),
    nebDetails: await read('NEB_Details.csv'),
    subject: await read('Subject.csv'),
    scores: await read('Scores.csv'),
  },
  prefix,
);

const count = (key: (s: (typeof data.students)[number]) => string) =>
  data.students.reduce<Record<string, number>>((m, s) => ({ ...m, [key(s)]: (m[key(s)] ?? 0) + 1 }), {});
const missing = (pick: (s: (typeof data.students)[number]) => unknown) => data.students.filter((s) => !pick(s)).length;
const marks = data.students.reduce((n, s) => n + s.scores.length * 2, 0);

console.log(`Students ${data.students.length} · subject components ${data.subjects.length} · marks ${marks}`);
console.log('By stream:', count((s) => s.stream || '(none)'));
console.log('By gender:', count((s) => s.gender));
console.log('Subjects per student:', count((s) => String(s.scores.length)));
console.log(
  `Missing: DOB B.S. ${missing((s) => s.dobBs)} · DOB A.D. ${missing((s) => s.dobAd)} · ` +
    `reg. no. ${missing((s) => s.nebRegistrationNo)} · symbol no. ${missing((s) => s.symbolNo)}`,
);
const first = data.students[0];
if (first) {
  console.log(
    `First student: ${first.admissionNo} ${[first.firstName, first.middleName, first.lastName].filter(Boolean).join(' ')} · ` +
      `DOB ${first.dobBs} B.S. / ${first.dobAd} A.D. · reg. ${first.nebRegistrationNo} · symbol ${first.symbolNo}`,
  );
}
console.log(`\n${data.warnings.length} warning(s)`);
data.warnings.forEach((w) => console.log(`  - ${w}`));
