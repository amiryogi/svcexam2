/**
 * Parses a marks workbook as teachers keep it: one sheet per class ("XII MGMT", "XI SCIENCE" …), a
 * header row of subject abbreviations (ECO, ENG, CHE …) followed by a full-mark row ("FM 75"), then
 * one row per student: roll number, name, one cell per subject. Header blocks may repeat further down
 * a sheet. An optional "Gender" column (M/F) is read for students the import creates.
 * Pure: no database, so it is unit-tested with plain arrays.
 */

export type MarkEntry = { status: 'PRESENT'; marks: number } | { status: 'ABSENT'; marks: null };

export interface SheetCell {
  /** Subject familyCode (NEP, ENG, CHEM …). */
  family: string;
  /** Column heading as written in the sheet. */
  header: string;
  fullMark: number;
  /** Cell reference for messages, e.g. "D12". */
  ref: string;
  /** null = blank (subject not taken); 'STARRED' = "*", left empty. */
  entry: MarkEntry | 'STARRED' | null;
}

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export interface SheetStudent {
  row: number;
  rollNo: number;
  name: string;
  /** From an optional "Gender" column; null when the sheet has none or the cell is blank. */
  gender: Gender | null;
  cells: SheetCell[];
}

export interface ClassSheet {
  sheet: string;
  grade: 11 | 12;
  streamCode: string;
  students: SheetStudent[];
}

export interface ParsedWorkbook {
  classes: ClassSheet[];
  errors: string[];
}

/** Column headings → subject familyCode. Anything else in a header row (TOTAL, NAME …) is ignored. */
const SUBJECT_ALIASES: Record<string, string> = {
  NEP: 'NEP',
  NEPALI: 'NEP',
  ENG: 'ENG',
  ENGLISH: 'ENG',
  SOC: 'SOC',
  SOCIAL: 'SOC',
  MATH: 'MATH',
  MATHS: 'MATH',
  MATHEMATICS: 'MATH',
  PHY: 'PHY',
  PHYSICS: 'PHY',
  CHE: 'CHEM',
  CHEM: 'CHEM',
  CHEMISTRY: 'CHEM',
  BIO: 'BIO',
  BIOLOGY: 'BIO',
  ACC: 'ACC',
  ACCOUNT: 'ACC',
  ACCOUNTS: 'ACC',
  ACCOUNTANCY: 'ACC',
  ACCOUNTING: 'ACC',
  ECO: 'ECO',
  ECONOMICS: 'ECO',
  BUS: 'BUS',
  BUSINESS: 'BUS',
  CS: 'CS',
  COMPUTER: 'CS',
  HM: 'HM',
  HOTEL: 'HM',
};

const ABSENT = /^(A|AB|ABS|ABSENT)$/i;
const GENDER_HEADING = /^(GENDER|SEX)$/;
const GENDERS: Record<string, Gender> = {
  M: 'MALE',
  MALE: 'MALE',
  BOY: 'MALE',
  F: 'FEMALE',
  FEMALE: 'FEMALE',
  GIRL: 'FEMALE',
  O: 'OTHER',
  OTHER: 'OTHER',
};

/** "M" / "F" / "O" (or the words) → Gender; undefined for anything else. */
export const parseGender = (v: string): Gender | undefined => GENDERS[v.trim().toUpperCase()];
const FULL_MARK = /^FM\s*(\d+(?:\.\d+)?)$/i;

const text = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
const subjectOf = (v: unknown) =>
  SUBJECT_ALIASES[
    text(v)
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
  ];
const colLetter = (i: number) => {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26))
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

/** "XII MGMT" → { grade: 12, stream: 'MGMT' }. Checks XII before XI. */
export function classOf(label: string): { grade?: 11 | 12; streamCode?: string } {
  const s = label.toUpperCase();
  const grade = /\bXII\b|\b12\b/.test(s) ? 12 : /\bXI\b|\b11\b/.test(s) ? 11 : undefined;
  const streamCode = /MGMT|MANAGEMENT/.test(s)
    ? 'MGMT'
    : /\bSCI(ENCE)?\b/.test(s)
      ? 'SCI'
      : undefined;
  return { grade, streamCode };
}

function parseEntry(v: unknown, fullMark: number): SheetCell['entry'] | { error: string } {
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v < 0) return { error: `invalid mark ${v}` };
    if (v > fullMark) return { error: `mark ${v} is above the full mark ${fullMark}` };
    return { status: 'PRESENT', marks: v };
  }
  const t = text(v);
  if (t === '') return null;
  if (t === '*') return 'STARRED';
  if (ABSENT.test(t)) return { status: 'ABSENT', marks: null };
  if (/^\d+(\.\d+)?$/.test(t)) return parseEntry(Number(t), fullMark);
  return { error: `unrecognised value "${t}" (use a number, A for absent, or * to leave empty)` };
}

interface Column {
  index: number;
  family: string;
  header: string;
  fullMark: number;
}

export function parseMarksSheets(sheets: { name: string; rows: unknown[][] }[]): ParsedWorkbook {
  const classes: ClassSheet[] = [];
  const errors: string[] = [];

  for (const { name, rows } of sheets) {
    if (!rows.some((r) => r.some((v) => text(v) !== ''))) continue; // empty sheet
    const title =
      rows
        .flat()
        .map(text)
        .find((t) => t !== '') ?? '';
    const fromName = classOf(name);
    const fromTitle = classOf(title);
    const grade = fromName.grade ?? fromTitle.grade;
    const streamCode = fromName.streamCode ?? fromTitle.streamCode;
    if (!grade || !streamCode) {
      errors.push(
        `Sheet "${name}": cannot tell the grade and stream from its name or title (e.g. "XII MGMT")`,
      );
      continue;
    }

    const students: SheetStudent[] = [];
    const seenRolls = new Map<number, number>();
    let columns: Column[] | null = null;
    let genderCol: number | null = null;

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const at = (c: number) => `"${name}" ${colLetter(c)}${r + 1}`;

      // A header row: subject headings from column C on, and full marks in the next row.
      const headings = row
        .map((v, c) => ({ c, family: c >= 2 ? subjectOf(v) : undefined }))
        .filter((h) => h.family);
      if (headings.length >= 2) {
        const fmRow = rows[r + 1] ?? [];
        // "Gender" may be written in the subject row or in the full-mark row (next to R.N. / NAME).
        const genderAt = (cells: unknown[]) =>
          cells.findIndex(
            (v, c) =>
              c >= 1 &&
              GENDER_HEADING.test(
                text(v)
                  .toUpperCase()
                  .replace(/[^A-Z]/g, ''),
              ),
          );
        const g = Math.max(genderAt(row), genderAt(fmRow));
        genderCol = g >= 0 ? g : null;
        columns = [];
        for (const { c, family } of headings) {
          const fm = FULL_MARK.exec(text(fmRow[c]).replace(/\s+/g, ' '));
          if (!fm) {
            errors.push(`${at(c)}: no full mark ("FM 75") under the ${text(row[c])} heading`);
            continue;
          }
          columns.push({
            index: c,
            family: family!,
            header: text(row[c]),
            fullMark: Number(fm[1]),
          });
        }
        const families = columns.map((col) => col.family);
        const dup = families.find((f, i) => families.indexOf(f) !== i);
        if (dup)
          errors.push(`Sheet "${name}" row ${r + 1}: two columns for the same subject (${dup})`);
        r++; // skip the full-mark row
        continue;
      }

      // A student row: a roll number in column A and a name in column B.
      const roll =
        typeof row[0] === 'number'
          ? row[0]
          : /^\d+$/.test(text(row[0]))
            ? Number(text(row[0]))
            : NaN;
      const studentName = text(row[1]).replace(/\s+/g, ' ');
      if (!Number.isInteger(roll) || studentName === '') continue;
      if (!columns) {
        errors.push(`${at(0)}: student row before any subject header row`);
        continue;
      }
      if (seenRolls.has(roll)) {
        errors.push(`${at(0)}: roll ${roll} appears twice (also row ${seenRolls.get(roll)})`);
        continue;
      }
      seenRolls.set(roll, r + 1);

      let gender: Gender | null = null;
      if (genderCol !== null && text(row[genderCol]) !== '') {
        const g = parseGender(text(row[genderCol]));
        if (!g) {
          errors.push(
            `${at(genderCol)} (${studentName}): gender "${text(row[genderCol])}" is not M or F`,
          );
          continue;
        }
        gender = g;
      }

      const cells: SheetCell[] = [];
      for (const col of columns) {
        const entry = parseEntry(row[col.index], col.fullMark);
        if (entry && typeof entry === 'object' && 'error' in entry) {
          errors.push(`${at(col.index)} (${studentName}, ${col.header}): ${entry.error}`);
          continue;
        }
        cells.push({
          family: col.family,
          header: col.header,
          fullMark: col.fullMark,
          ref: `${colLetter(col.index)}${r + 1}`,
          entry,
        });
      }
      students.push({ row: r + 1, rollNo: roll, name: studentName, gender, cells });
    }
    classes.push({ sheet: name, grade, streamCode, students });
  }
  return { classes, errors };
}

/** "ANIL B.K." → { firstName: 'Anil', middleName: null, lastName: 'B.K.' }; null for a one-word name. */
export function splitName(name: string) {
  const parts = name
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/(^|[.'-])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase()));
  if (parts.length < 2) return null;
  return {
    firstName: parts[0]!,
    middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : null,
    lastName: parts[parts.length - 1]!,
  };
}

/** Name comparison key: upper-case letters only, so "Sangharsha K.C." matches "SANGHARSHA  KC". */
export const nameKey = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, '');
const words = (s: string) =>
  s
    .toUpperCase()
    .replace(/\./g, '')
    .split(/[^A-Z]+/)
    .filter(Boolean);

/** Same name, allowing other spacing/punctuation or another word order. */
export function sameName(a: string, b: string): boolean {
  if (nameKey(a) === nameKey(b)) return true;
  return [...words(a)].sort().join(' ') === [...words(b)].sort().join(' ');
}

function editDistance(x: string, y: string): number {
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) {
      cur[j] = Math.min(
        prev[j]! + 1,
        cur[j - 1]! + 1,
        prev[j - 1]! + (x[i - 1] === y[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[y.length]!;
}

const closeness = (x: string, y: string) =>
  1 - editDistance(x, y) / Math.max(x.length, y.length, 1);

/**
 * How alike two names are, 0–1. The better of: the whole name letter by letter ("RIJWANA KHATOON" ~
 * "Rizwana Khatoon"), or every word of the shorter name matching a word of the longer one, which
 * allows a missing middle or last name ("SANJILA SAHANI" ~ "Sanjila Kumari Sahani",
 * "NGOEDUP LHAMU" ~ "Ngoedup Lhamo Baijee"), scored slightly lower.
 */
export function nameSimilarity(a: string, b: string): number {
  if (sameName(a, b)) return 1;
  const whole = closeness(nameKey(a), nameKey(b));
  const [short, long] = [words(a), words(b)].sort((p, q) => p.length - q.length) as [
    string[],
    string[],
  ];
  if (short.length < 2) return whole;
  const perWord = short.map((w) => Math.max(...long.map((v) => closeness(w, v))));
  const subset = perWord.every((x) => x >= 0.75)
    ? (0.95 * perWord.reduce((t, x) => t + x, 0)) / perWord.length
    : 0;
  return Math.max(whole, subset);
}

/** Similar enough to be the same person, when nothing matches exactly. */
export const SIMILAR = 0.8;

/**
 * The one candidate whose name is clearly the most similar (≥ SIMILAR, and 0.1 ahead of the next),
 * or null.
 */
export function closestName<T>(name: string, candidates: T[], nameOf: (c: T) => string) {
  const scored = candidates
    .map((c) => ({ c, score: nameSimilarity(name, nameOf(c)) }))
    .sort((x, y) => y.score - x.score);
  const [best, next] = scored;
  if (!best || best.score < SIMILAR || (next && next.score > best.score - 0.1)) return null;
  return best;
}
