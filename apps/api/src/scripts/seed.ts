/**
 * Idempotent seed: grade scale, streams, school settings, Grade 11 NEB subjects and curriculum.
 * Usage: npm run db:seed  (production: node dist/scripts/seed.js)
 */
import { NEB_FINAL_GRADE_BANDS, NEB_GRADE_BANDS } from '@svi/shared';
import { prisma } from '../lib/prisma.js';
import { GRADE11_CURRICULUM, GRADE11_SUBJECTS, STREAMS } from './seedData.js';

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

  for (const s of GRADE11_SUBJECTS) {
    const existing = await prisma.subject.findUnique({ where: { grade_familyCode: { grade: 11, familyCode: s.familyCode } } });
    if (existing) continue;
    await prisma.subject.create({
      data: {
        grade: 11,
        familyCode: s.familyCode,
        name: s.name,
        category: s.category,
        components: {
          create: [
            { type: 'TH', nebCode: s.th.code, creditHour: s.th.ch, fullMark: s.th.fm },
            { type: 'IN', nebCode: s.in.code, creditHour: s.in.ch, fullMark: s.in.fm },
          ],
        },
      },
    });
  }
  console.log('✓ grade 11 subjects');

  const subjects = await prisma.subject.findMany({ where: { grade: 11 } });
  const byFamily = new Map(subjects.map((s) => [s.familyCode, s.id]));
  for (const [streamCode, groups] of Object.entries(GRADE11_CURRICULUM)) {
    const stream = await prisma.stream.findUniqueOrThrow({ where: { code: streamCode } });
    if (await prisma.curriculumGroup.count({ where: { streamId: stream.id, grade: 11 } })) continue;
    for (const [i, g] of groups.entries()) {
      await prisma.curriculumGroup.create({
        data: {
          streamId: stream.id,
          grade: 11,
          name: g.name,
          minSelect: g.min,
          maxSelect: g.max,
          sortOrder: i,
          subjects: { create: g.families.map((f) => ({ subjectId: byFamily.get(f)! })) },
        },
      });
    }
  }
  console.log('✓ grade 11 curriculum');
  console.log('Seed complete. Create the first admin with: npm run create-admin');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
