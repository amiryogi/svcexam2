import { Router } from 'express';
import type { PublicBranding } from '@svi/shared';
import { notFound } from '../../lib/errors.js';
import { getSettingsRow, readWebsiteLogo } from './settings.service.js';

/**
 * Endpoints available before sign-in, so the login page can show the school's identity.
 * Only what already appears on every grade sheet is exposed: name, address and logo.
 */
export const publicRouter = Router();

publicRouter.get('/branding', async (_req, res) => {
  const s = await getSettingsRow();
  const body: PublicBranding = {
    name: s.name,
    address: s.address,
    // Website shows the colour logo; falls back to the grade sheet logo if none is uploaded.
    hasLogo: Boolean(s.webLogoPath ?? s.logoPath),
    // Changes whenever settings (including the logo) are saved; used to bust the logo cache.
    version: s.updatedAt.getTime(),
  };
  res.setHeader('Cache-Control', 'no-cache');
  res.json(body);
});

publicRouter.get('/logo', async (req, res) => {
  const logo = await readWebsiteLogo();
  if (!logo) throw notFound('Logo');
  res.setHeader('Content-Type', logo.mime);
  // Versioned URLs (?v=…) can be cached for a long time; unversioned ones are revalidated.
  res.setHeader('Cache-Control', req.query.v ? 'public, max-age=31536000, immutable' : 'no-cache');
  res.send(logo.data);
});
