/**
 * Creates (or resets) a SUPER_ADMIN account. There is deliberately no default password.
 * Interactive:      npm run create-admin
 * Non-interactive:  ADMIN_USERNAME=... ADMIN_FULLNAME=... ADMIN_PASSWORD=... node dist/scripts/createAdmin.js
 */
import { createInterface } from 'node:readline';
import { passwordSchema, userCreateSchema } from '@svi/shared';
import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../modules/auth/auth.service.js';

function ask(question: string, hidden = false): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    // Mask typed characters.
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
      process.stdout.write(s.includes(question) ? s : '*');
    };
  }
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    }),
  );
}

async function main() {
  const username = process.env.ADMIN_USERNAME ?? (await ask('Username: '));
  const fullName = process.env.ADMIN_FULLNAME ?? (await ask('Full name: '));
  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    password = await ask('Password: ', true);
    if ((await ask('Confirm password: ', true)) !== password) throw new Error('Passwords do not match');
  }
  const pw = passwordSchema.safeParse(password);
  if (!pw.success) throw new Error(pw.error.issues[0]?.message ?? 'Weak password');
  const input = userCreateSchema.parse({ username, fullName, password, role: 'SUPER_ADMIN' });

  const passwordHash = await hashPassword(input.password);
  const existing = await prisma.user.findUnique({ where: { username: input.username } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, role: 'SUPER_ADMIN', isActive: true, failedLoginCount: 0, lockedUntil: null, passwordChangedAt: new Date() },
    });
    await prisma.session.updateMany({ where: { userId: existing.id, revokedAt: null }, data: { revokedAt: new Date() } });
    console.log(`✓ Reset password for ${input.username}`);
  } else {
    await prisma.user.create({
      data: { username: input.username, fullName: input.fullName, role: 'SUPER_ADMIN', passwordHash },
    });
    console.log(`✓ Created super admin ${input.username}`);
  }
}

main()
  .catch((e) => {
    console.error(`✗ ${(e as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
