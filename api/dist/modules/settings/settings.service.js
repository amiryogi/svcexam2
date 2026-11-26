import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env.js';
import { badRequest } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
const DEFAULT_NAME = 'Siddhartha Vanasthali Institute';
export async function getSettingsRow(db = prisma) {
    return ((await db.schoolSetting.findUnique({ where: { id: 1 } })) ??
        (await db.schoolSetting.create({ data: { id: 1, name: DEFAULT_NAME } })));
}
export const toSchoolInfo = (s) => ({
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
    hasWebLogo: Boolean(s.webLogoPath),
});
const storagePath = (file) => path.resolve(env.STORAGE_DIR, file);
const LOGO_BASE = { print: 'logo', web: 'logo-web' };
const LOGO_FIELD = { print: 'logoPath', web: 'webLogoPath' };
const EXTS = ['png', 'jpg', 'webp'];
const MIME = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
/** Detects PNG / JPEG / WebP from magic bytes – the client-declared type is not trusted. */
export function sniffImage(buf) {
    if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
        return 'png';
    if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
        return 'jpg';
    if (buf.length > 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP')
        return 'webp';
    return null;
}
export async function saveLogo(buf, kind = 'print') {
    const ext = sniffImage(buf);
    // The PDF renderer handles all three, but keep the print logo to the most portable formats.
    if (!ext || (kind === 'print' && ext === 'webp')) {
        throw badRequest(kind === 'web' ? 'Website logo must be a PNG, JPEG or WebP image' : 'Grade sheet logo must be a PNG or JPEG image');
    }
    await mkdir(path.resolve(env.STORAGE_DIR), { recursive: true });
    const file = `${LOGO_BASE[kind]}.${ext}`;
    // Remove the same logo saved earlier in another format.
    for (const other of EXTS)
        if (other !== ext)
            await rm(storagePath(`${LOGO_BASE[kind]}.${other}`), { force: true });
    await writeFile(storagePath(file), buf);
    await prisma.schoolSetting.update({ where: { id: 1 }, data: { [LOGO_FIELD[kind]]: file } });
    return file;
}
export async function removeLogo(kind) {
    for (const ext of EXTS)
        await rm(storagePath(`${LOGO_BASE[kind]}.${ext}`), { force: true });
    await prisma.schoolSetting.update({ where: { id: 1 }, data: { [LOGO_FIELD[kind]]: null } });
}
export async function readLogo(kind = 'print') {
    const s = await getSettingsRow();
    const file = s[LOGO_FIELD[kind]];
    if (!file)
        return null;
    try {
        const data = await readFile(storagePath(path.basename(file)));
        return { data, mime: MIME[file.split('.').pop() ?? 'png'] ?? 'image/png' };
    }
    catch {
        return null;
    }
}
/** Logo for the website: the colour logo, or the grade sheet logo if no colour logo is uploaded. */
export async function readWebsiteLogo() {
    return (await readLogo('web')) ?? (await readLogo('print'));
}
/** Grade sheet / ledger logo (black & white) as a data URI for the PDF renderer. */
export async function logoDataUri() {
    const logo = await readLogo('print');
    return logo ? `data:${logo.mime};base64,${logo.data.toString('base64')}` : null;
}
//# sourceMappingURL=settings.service.js.map