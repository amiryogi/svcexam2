import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { purgeSessions } from './modules/auth/auth.service.js';
import { closeBrowser } from './pdf/browser.js';

const app = createApp();
// Express 5 passes listen errors (e.g. EADDRINUSE) to this callback instead of throwing.
const server = app.listen(env.PORT, (err?: Error) => {
  if (err) {
    logger.fatal({ err }, `Could not listen on :${env.PORT}`);
    process.exit(1);
  }
  logger.info(`API listening on :${env.PORT} (${env.NODE_ENV})`);
});

const purge = setInterval(() => {
  purgeSessions().catch((err) => logger.warn({ err }, 'Session purge failed'));
}, 60 * 60_000);
purge.unref();

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received, shutting down`);
  server.close();
  await Promise.allSettled([closeBrowser(), prisma.$disconnect()]);
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
