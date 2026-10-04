/**
 * Idempotent seed: grade scale, streams, school settings, Grade 11–12 NEB subjects and curriculum.
 * Usage: npm run db:seed  (production: node dist/scripts/seed.js)
 */
import { NEB_FINAL_GRADE_BANDS, NEB_GRADE_BANDS, NEB_SUBJECT_CATALOG } from '@svi/shared';
import { prisma } from '../lib/prisma.js';
import { CURRICULUM, STREAMS } from './seedData.js';

async function main() {
  // Grade scale – only created if missing so admin edits are never overwritten.
  const scaleName = 'NEB Letter Grading';
  if (!(await prisma.gradeScale.findUnique({ where: { name: scaleName } }))) {
    await prisma.gradeScale.create({
      data: {
        name: scaleName,
        isDefault: true,
        withholdGpaOnNg: true,
        bands: { create: NEB_GRADE_BANDS },
        finalBands: { create: NEB_FINAL_GRADE_BANDS },
      },
    });
    console.log('✓ grade scale');
  }

  for (const s of STREAMS) {
    await prisma.stream.upsert({ where: { code: s.code }, create: s, update: {} });
  }
  console.log('✓ streams');

  await prisma.schoolSetting.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      name: 'Siddhartha Vanasthali Institute',
      address: 'Balaju, Kathmandu',
      principalTitle: 'Campus Chief',
    },
    update: {},
  });
  console.log('✓ school settings');

  // Grade 11 and 12 subjects from the NEB catalog (codes, credit hours, full marks).
  for (const c of NEB_SUBJECT_CATALOG) {
    const existing = await prisma.subject.findUnique({ where: { grade_familyCode: { grade: c.grade, familyCode: c.familyCode } } });
    if (existing) continue;
    await prisma.subject.create({
      data: {
        grade: c.grade,
        familyCode: c.familyCode,
        name: c.name,
        category: c.category,
        components: {
          create: [
            { type: 'TH', nebCode: c.th.code, creditHour: c.th.creditHour, fullMark: c.th.fullMark },
            { type: 'IN', nebCode: c.in.code, creditHour: c.in.creditHour, fullMark: c.in.fullMark },
          ],
        },
      },
    });
  }
  console.log('✓ grade 11 and 12 subjects');

  // Both grades use the same subject groups (families) per stream.
  for (const grade of [11, 12]) {
    const subjects = await prisma.subject.findMany({ where: { grade } });
    const byFamily = new Map(subjects.map((s) => [s.familyCode, s.id]));
    for (const [streamCode, groups] of Object.entries(CURRICULUM)) {
      const stream = await prisma.stream.findUniqueOrThrow({ where: { code: streamCode } });
      if (await prisma.curriculumGroup.count({ where: { streamId: stream.id, grade } })) continue;
      for (const [i, g] of groups.entries()) {
        await prisma.curriculumGroup.create({
          data: {
            streamId: stream.id,
            grade,
            name: g.name,
            minSelect: g.min,
            maxSelect: g.max,
            sortOrder: i,
            subjects: { create: g.families.map((f) => ({ subjectId: byFamily.get(f)! })) },
          },
        });
      }
    }
  }
  console.log('✓ grade 11 and 12 curriculum');
  console.log('Seed complete. Create the first admin with: npm run create-admin');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
