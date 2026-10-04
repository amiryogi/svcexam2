import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { SchoolSetting } from '@prisma/client';
import type { SchoolInfo } from '@svi/shared';
import { env } from '../../config/env.js';
import { badRequest } from '../../lib/errors.js';
import { prisma, type Db } from '../../lib/prisma.js';

const DEFAULT_NAME = 'Siddhartha Vanasthali Institute';

export async function getSettingsRow(db: Db = prisma): Promise<SchoolSetting> {
  return (
    (await db.schoolSetting.findUnique({ where: { id: 1 } })) ??
    (await db.schoolSetting.create({ data: { id: 1, name: DEFAULT_NAME } }))
  );
}

export const toSchoolInfo = (s: SchoolSetting): SchoolInfo => ({
  name: s.name,
  address: s.address,
  phone: s.phone,
  email: s.email,
  website: s.website,
  nebSchoolCode: s.nebSchoolCode,
  preparedByName: s.preparedByName,
  checkedByName: s.checkedByName,
  principalName: s.principalName,
  principalTitle: s.principalTitle,
  gradesheetNote: s.gradesheetNote,
  hasLogo: Boolean(s.logoPath),
});

const storagePath = (file: string) => path.resolve(env.STORAGE_DIR, file);

/** Detects PNG / JPEG from magic bytes – the client-declared type is not trusted. */
export function sniffImage(buf: Buffer): 'png' | 'jpg' | null {
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  return null;
}

export async function saveLogo(buf: Buffer): Promise<string> {
  const ext = sniffImage(buf);
  if (!ext) throw badRequest('Logo must be a PNG or JPEG image');
  await mkdir(path.resolve(env.STORAGE_DIR), { recursive: true });
  const file = `logo.${ext}`;
  await rm(storagePath(ext === 'png' ? 'logo.jpg' : 'logo.png'), { force: true });
  await writeFile(storagePath(file), buf);
  await prisma.schoolSetting.update({ where: { id: 1 }, data: { logoPath: file } });
  return file;
}

export async function readLogo(): Promise<{ data: Buffer; mime: string } | null> {
  const s = await getSettingsRow();
  if (!s.logoPath) return null;
  try {
    const data = await readFile(storagePath(path.basename(s.logoPath)));
    return { data, mime: s.logoPath.endsWith('.png') ? 'image/png' : 'image/jpeg' };
  } catch {
    return null;
  }
}

export async function logoDataUri(): Promise<string | null> {
  const logo = await readLogo();
  return logo ? `data:${logo.mime};base64,${logo.data.toString('base64')}` : null;
}
