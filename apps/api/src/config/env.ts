import { z } from 'zod';

if (process.env.NODE_ENV !== 'production') {
  try {
    process.loadEnvFile();
  } catch {
    // no .env file – rely on the real environment
  }
}

const bool = (def: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(def)
    .transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  /** Public origin of the web app, used for Origin checks on state-changing requests. */
  APP_ORIGIN: z.url().default('http://localhost:5173'),
  COOKIE_SECURE: bool('false'),
  /** Number of reverse proxies in front of the API (Nginx = 1). Needed for correct client IPs. */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).default(30),
  SESSION_ABSOLUTE_HOURS: z.coerce.number().int().min(1).default(12),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(3).default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().min(1).default(15),
  STORAGE_DIR: z.string().default('./storage'),
  /** Chrome/Chromium/Edge executable used for PDF rendering. */
  CHROME_PATH: z.string().optional(),
  CHROME_NO_SANDBOX: bool('false'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const SESSION_COOKIE = env.COOKIE_SECURE ? '__Host-svi_sid' : 'svi_sid';
