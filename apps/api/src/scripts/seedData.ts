// Subjects (NEB codes, credit hours, full marks) live in @svi/shared → NEB_SUBJECT_CATALOG.

export const STREAMS = [
  { code: 'SCI', name: 'Science', isActive: true },
  { code: 'MGMT', name: 'Management', isActive: true },
  { code: 'HUM', name: 'Humanities', isActive: false },
  { code: 'EDU', name: 'Education', isActive: false },
  { code: 'LAW', name: 'Law', isActive: false },
];

/**
 * Subject groups per stream (same families in Grade 11 and 12), derived from the subject
 * combinations registered with NEB in the school's Access data.
 */
export const CURRICULUM: Record<string, { name: string; min: number; max: number; families: string[] }[]> = {
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
