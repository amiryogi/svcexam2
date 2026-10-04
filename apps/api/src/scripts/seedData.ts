import type { SubjectCategory } from '@prisma/client';

export interface SeedSubject {
  familyCode: string;
  name: string;
  category: SubjectCategory;
  th: { code: string; ch: number; fm: number };
  in: { code: string; ch: number; fm: number };
}

/**
 * Grade 11 subjects as used in the school's Access database (NEB codes, credit hours, full marks).
 * Grade 12 subjects should be added from NEB's official code list via Setup → Subjects, using the
 * same family codes so that promotion 11 → 12 can map them.
 */
export const GRADE11_SUBJECTS: SeedSubject[] = [
  { familyCode: 'NEP', name: 'Comp. Nepali', category: 'COMPULSORY', th: { code: '0011', ch: 2.25, fm: 75 }, in: { code: '0012', ch: 0.75, fm: 25 } },
  { familyCode: 'ENG', name: 'Comp. English', category: 'COMPULSORY', th: { code: '0031', ch: 3, fm: 75 }, in: { code: '0032', ch: 1, fm: 25 } },
  { familyCode: 'SOC', name: 'Comp. Soc. Std. & life Skill', category: 'COMPULSORY', th: { code: '0051', ch: 3.75, fm: 75 }, in: { code: '0052', ch: 1.25, fm: 25 } },
  { familyCode: 'MATH', name: 'Comp. Mathematics', category: 'COMPULSORY', th: { code: '0071', ch: 3.75, fm: 75 }, in: { code: '0072', ch: 1.25, fm: 25 } },
  { familyCode: 'PHY', name: 'Physics', category: 'OPTIONAL', th: { code: '1011', ch: 3.75, fm: 75 }, in: { code: '1012', ch: 1.25, fm: 25 } },
  { familyCode: 'ACC', name: 'Accounting', category: 'OPTIONAL', th: { code: '1031', ch: 3.75, fm: 75 }, in: { code: '1032', ch: 1.25, fm: 25 } },
  { familyCode: 'BIO', name: 'Biology', category: 'OPTIONAL', th: { code: '2011', ch: 3.75, fm: 75 }, in: { code: '2012', ch: 1.25, fm: 25 } },
  { familyCode: 'BUS', name: 'Business Studies', category: 'OPTIONAL', th: { code: '2151', ch: 3.75, fm: 75 }, in: { code: '2152', ch: 1.25, fm: 25 } },
  { familyCode: 'CHEM', name: 'Chemistry', category: 'OPTIONAL', th: { code: '3011', ch: 3.75, fm: 75 }, in: { code: '3012', ch: 1.25, fm: 25 } },
  { familyCode: 'ECO', name: 'Economics', category: 'OPTIONAL', th: { code: '3031', ch: 3.75, fm: 75 }, in: { code: '3032', ch: 1.25, fm: 25 } },
  { familyCode: 'CS', name: 'Computer Science', category: 'OPTIONAL', th: { code: '4271', ch: 2.5, fm: 50 }, in: { code: '4272', ch: 2.5, fm: 50 } },
  { familyCode: 'HM', name: 'Hotel Management', category: 'OPTIONAL', th: { code: '4391', ch: 2.5, fm: 50 }, in: { code: '4392', ch: 2.5, fm: 50 } },
];

export const STREAMS = [
  { code: 'SCI', name: 'Science', isActive: true },
  { code: 'MGMT', name: 'Management', isActive: true },
  { code: 'HUM', name: 'Humanities', isActive: false },
  { code: 'EDU', name: 'Education', isActive: false },
  { code: 'LAW', name: 'Law', isActive: false },
];

/** Grade 11 subject groups, derived from the subject combinations registered with NEB in the Access data. */
export const GRADE11_CURRICULUM: Record<string, { name: string; min: number; max: number; families: string[] }[]> = {
  SCI: [
    { name: 'Compulsory', min: 3, max: 3, families: ['NEP', 'ENG', 'MATH'] },
    { name: 'Optional I', min: 1, max: 1, families: ['PHY'] },
    { name: 'Optional II', min: 1, max: 1, families: ['CHEM'] },
    { name: 'Optional III', min: 1, max: 1, families: ['BIO', 'CS'] },
  ],
  MGMT: [
    { name: 'Compulsory', min: 2, max: 2, families: ['NEP', 'ENG'] },
    { name: 'Social Studies / Mathematics', min: 1, max: 1, families: ['SOC', 'MATH'] },
    { name: 'Optional I', min: 1, max: 1, families: ['ACC'] },
    { name: 'Optional II', min: 1, max: 1, families: ['ECO'] },
    { name: 'Optional III', min: 1, max: 1, families: ['CS', 'HM', 'BUS'] },
  ],
};
