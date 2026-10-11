import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer, { type Browser, type LaunchOptions } from 'puppeteer-core';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

const CANDIDATES = [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

const systemChrome = () => env.CHROME_PATH ?? CANDIDATES.find((p) => existsSync(p));

/** Fonts shipped with the API (apps/api/fonts) for the bundled Chromium, which has no system fonts. */
const FONTS_DIR = fileURLToPath(new URL('../../fonts', import.meta.url));

/** A fontconfig file that points at FONTS_DIR, so templates get Liberation Serif/Sans. */
async function writeFontConfig(): Promise<string> {
  const dir = path.join(tmpdir(), 'svi-fontconfig');
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, 'fonts.conf');
  await writeFile(
    file,
    `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${FONTS_DIR}</dir>
  <cachedir>${path.join(dir, 'cache')}</cachedir>
  <alias><family>serif</family><prefer><family>Liberation Serif</family></prefer></alias>
  <alias><family>sans-serif</family><prefer><family>Liberation Sans</family></prefer></alias>
</fontconfig>
`,
  );
  return file;
}

/**
 * Launch options for @sparticuz/chromium, a self-contained headless Chromium for hosts that have
 * no browser installed (cPanel shared hosting). It is extracted to the temp dir on first use.
 */
async function bundledChromeOptions(): Promise<LaunchOptions> {
  if (process.platform !== 'linux') {
    throw new AppError(500, 'PDF_UNAVAILABLE', 'PDF rendering is not configured (set CHROME_PATH)');
  }
  const { default: chromium, inflate, setupLambdaEnvironment } = await import('@sparticuz/chromium');
  chromium.setGraphicsMode = false;
  if (env.CHROME_BUNDLED_LIBS) {
    const bin = fileURLToPath(new URL('../bin/', import.meta.resolve('@sparticuz/chromium')));
    await inflate(path.join(bin, 'al2023.tar.br'));
    setupLambdaEnvironment(path.join(tmpdir(), 'al2023', 'lib'));
  }
  return {
    executablePath: await chromium.executablePath(),
    headless: 'shell',
    args: [...chromium.args, '--disable-dev-shm-usage', '--disable-extensions'],
    env: { ...process.env, FONTCONFIG_FILE: await writeFontConfig() },
  };
}

async function launchOptions(): Promise<LaunchOptions> {
  const executablePath = systemChrome();
  if (!executablePath) return bundledChromeOptions();
  return {
    executablePath,
    headless: true,
    args: [
      ...(env.CHROME_NO_SANDBOX ? ['--no-sandbox', '--disable-setuid-sandbox'] : []),
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--font-render-hinting=none',
    ],
  };
}

let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  browserPromise ??= launchOptions()
    .then((opts) => puppeteer.launch(opts))
    .then((b) => {
      b.on('disconnected', () => {
        browserPromise = null;
      });
      return b;
    })
    .catch((err: unknown) => {
      browserPromise = null;
      if (err instanceof AppError) throw err;
      logger.error({ err }, 'Could not start Chromium');
      throw new AppError(500, 'PDF_UNAVAILABLE', 'PDF rendering failed to start');
    });
  return browserPromise;
}

// Simple semaphore: at most 2 pages render at once, or 1 with the single-process bundled Chromium.
let maxConcurrent: number | undefined;
let active = 0;
const waiting: (() => void)[] = [];
async function acquire() {
  maxConcurrent ??= systemChrome() ? 2 : 1;
  if (active < maxConcurrent) {
    active++;
    return;
  }
  await new Promise<void>((resolve) => waiting.push(resolve));
  active++;
}
function release() {
  active--;
  waiting.shift()?.();
}

/**
 * Renders trusted, server-built HTML to an A4 PDF. JavaScript is disabled and every network
 * request is blocked, so templates must inline images as data: URIs.
 */
export async function renderPdf(html: string, opts: { landscape?: boolean } = {}): Promise<Buffer> {
  await acquire();
  const browser = await getBrowser().catch((e) => {
    release();
    throw e;
  });
  const page = await browser.newPage();
  try {
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      const url = r.url();
      if (url.startsWith('data:') || url === 'about:blank') void r.continue();
      else void r.abort();
    });
    await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });
    const pdf = await page.pdf({
      format: 'A4',
      landscape: opts.landscape ?? false,
      printBackground: true,
      preferCSSPageSize: true,
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => undefined);
    release();
  }
}

export async function closeBrowser() {
  if (!browserPromise) return;
  const b = await browserPromise.catch(() => null);
  browserPromise = null;
  await b?.close();
}
