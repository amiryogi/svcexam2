import { existsSync } from 'node:fs';
import puppeteer, { type Browser } from 'puppeteer-core';
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

function chromePath(): string {
  const path = env.CHROME_PATH ?? CANDIDATES.find((p) => existsSync(p));
  if (!path) throw new AppError(500, 'PDF_UNAVAILABLE', 'PDF rendering is not configured (set CHROME_PATH)');
  return path;
}

let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  browserPromise ??= puppeteer
    .launch({
      executablePath: chromePath(),
      headless: true,
      args: [
        ...(env.CHROME_NO_SANDBOX ? ['--no-sandbox', '--disable-setuid-sandbox'] : []),
        '--disable-dev-shm-usage',
        '--disable-extensions',
        '--font-render-hinting=none',
      ],
    })
    .then((b) => {
      b.on('disconnected', () => {
        browserPromise = null;
      });
      return b;
    })
    .catch((err) => {
      browserPromise = null;
      logger.error({ err }, 'Could not start Chromium');
      throw new AppError(500, 'PDF_UNAVAILABLE', 'PDF rendering failed to start');
    });
  return browserPromise;
}

// Simple semaphore: at most 2 pages render at once.
const MAX_CONCURRENT = 2;
let active = 0;
const waiting: (() => void)[] = [];
async function acquire() {
  if (active < MAX_CONCURRENT) {
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
