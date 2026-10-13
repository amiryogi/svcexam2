import { parse } from 'csv-parse/sync';
import { bsToAd } from '../lib/bsDate.js';

export interface AccessCsv {
  studentDetails: string;
  nebDetails: string;
  subject: string;
  scores: string;
}

export interface ImportScore {
  thCode: string;
  thMarks: number | null;
  inCode: string;
  inMarks: number | null;
}

export interface ImportStudent {
  legacyId: number;
  admissionNo: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  dobBs: string | null;
  dobAd: string | null;
  stream: string;
  nebRegistrationNo: string | null;
  symbolNo: string | null;
  scores: ImportScore[];
}

export interface ImportSubject {
  code: string;
  name: string;
  creditHour: number;
  fullMark: number;
  type: 'TH' | 'IN';
}

export interface TransformResult {
  students: ImportStudent[];
  subjects: ImportSubject[];
  warnings: string[];
}

const rows = (csv: string): Record<string, string>[] =>
  parse(csv, { columns: true, skip_empty_lines: true, trim: true, bom: true });

const titleCase = (s: string) =>
  s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ');

const numOrNull = (v: string | undefined) => (v === undefined || v === '' ? null : Number(v));

/**
 * Access stored B.S. dates as m/d/yyyy text, or (in later files) in a Date field that the
 * exporter writes as yyyy-mm-dd.
 */
export function normalizeBs(value: string): string | null {
  const v = value.trim();
  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2]!.padStart(2, '0')}-${iso[3]!.padStart(2, '0')}`;
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[1]!.padStart(2, '0')}-${m[2]!.padStart(2, '0')}`;
}

/**
 * Converts the Access tables into clean import records.
 * Fixes the name columns (most rows stored the surname in MiddleName with LName empty).
 */
export function transformAccess(csv: AccessCsv, admissionPrefix = 'SVI-'): TransformResult {
  const warnings: string[] = [];
  const neb = new Map(rows(csv.nebDetails).map((r) => [Number(r.StuId), r]));
  const scoresByStudent = new Map<number, ImportScore[]>();
  for (const r of rows(csv.scores)) {
    const id = Number(r.StuID);
    scoresByStudent.set(id, [
      ...(scoresByStudent.get(id) ?? []),
      { thCode: r.SubCode_Th!, thMarks: numOrNull(r.Score_Th), inCode: r.SubCode_In!, inMarks: numOrNull(r.Score_In) },
    ]);
  }

  const students: ImportStudent[] = rows(csv.studentDetails).map((r) => {
    const id = Number(r.StuId);
    const middle = r.MiddleName?.trim() ?? '';
    const last = r.LName?.trim() ?? '';
    const [middleName, lastName] = last ? [middle || null, last] : [null, middle];
    if (!lastName) warnings.push(`Student ${id}: no surname found`);

    const dobBs = r['DOB(BS)'] ? normalizeBs(r['DOB(BS)']) : null;
    let dobAd = r['DOB(AD)'] || null;
    if (r['DOB(BS)'] && !dobBs) warnings.push(`Student ${id}: unreadable B.S. date "${r['DOB(BS)']}"`);
    if (dobBs) {
      try {
        const converted = bsToAd(dobBs);
        if (dobAd && converted !== dobAd) {
          warnings.push(`Student ${id}: DOB ${dobBs} B.S. is ${converted} A.D., Access had ${dobAd}; using ${converted}`);
        }
        dobAd = converted;
      } catch {
        warnings.push(`Student ${id}: invalid B.S. date ${dobBs}`);
      }
    }
    const gender = (r.Gender ?? '').toUpperCase();
    const n = neb.get(id);
    if (!n) warnings.push(`Student ${id}: no NEB details`);
    const scores = scoresByStudent.get(id) ?? [];
    if (scores.length === 0) warnings.push(`Student ${id}: no scores`);

    return {
      legacyId: id,
      admissionNo: `${admissionPrefix}${String(id).padStart(4, '0')}`,
      firstName: titleCase(r.Fname ?? ''),
      middleName: middleName ? titleCase(middleName) : null,
      lastName: titleCase(lastName || '-'),
      gender: gender === 'MALE' || gender === 'FEMALE' ? gender : 'OTHER',
      dobBs,
      dobAd,
      stream: (r.Stream ?? '').trim(),
      nebRegistrationNo: n?.RegNo || null,
      symbolNo: n?.SymbolNo || null,
      scores,
    };
  });

  const subjects: ImportSubject[] = rows(csv.subject).map((r) => ({
    code: r.SubCode!,
    name: r.SubName!,
    creditHour: Number(r.CreditHour),
    fullMark: Number(r.FullMark),
    type: r.SubType === 'Theory' ? 'TH' : 'IN',
  }));

  return { students, subjects, warnings };
}
