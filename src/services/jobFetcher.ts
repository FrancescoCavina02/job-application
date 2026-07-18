import https from 'node:https';
import axios from 'axios';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const MIN_USEFUL_LENGTH = 500; // chars — less than this likely means a blocked/empty page

const insecureAgent = config.ignoreSslErrors
  ? new https.Agent({ rejectUnauthorized: false })
  : undefined;

export interface FetchResult {
  html: string;
  usedPlaywright: boolean;
}

/**
 * Fetches a job posting page.
 * Primary: plain HTTP via axios.
 * Fallback: Playwright headless Chromium if the response is blocked or too short.
 */
export async function fetchJobPage(url: string): Promise<FetchResult> {
  logger.info('Fetching job posting', { url });

  if (config.ignoreSslErrors) {
    logger.warn('Ignoring SSL certificate errors', { url });
  }

  try {
    const response = await axios.get<string>(url, {
      headers: { 'User-Agent': BROWSER_UA },
      timeout: 20_000,
      maxRedirects: 5,
      validateStatus: (status) => status < 500,
      ...(insecureAgent && { httpsAgent: insecureAgent }),
    });

    const html = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

    if (response.status === 200 && html.length >= MIN_USEFUL_LENGTH) {
      logger.info('Fetched via HTTP', { bytes: html.length });
      return { html, usedPlaywright: false };
    }

    logger.warn('HTTP fetch returned short/blocked response, falling back to Playwright', {
      status: response.status,
      length: html.length,
    });
  } catch (err) {
    logger.warn('HTTP fetch failed, falling back to Playwright', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return fetchWithPlaywright(url);
}

async function fetchWithPlaywright(url: string): Promise<FetchResult> {
  logger.info('Fetching via Playwright', { url });

  // Lazy import — Playwright is a dev dependency and may not have browsers installed
  let chromium: { launch: (opts?: object) => Promise<unknown> };
  try {
    const pw = await import('playwright');
    chromium = pw.chromium;
  } catch {
    throw new Error(
      'Playwright is not installed. Run: npx playwright install chromium\n' +
        'Or install it: npm install --save-dev playwright'
    );
  }

  const browser = await (chromium as { launch: (opts: object) => Promise<{
    newContext: (opts?: object) => Promise<{
      newPage: () => Promise<{
        goto: (url: string, opts: object) => Promise<unknown>;
        content: () => Promise<string>;
        close: () => Promise<void>;
      }>;
      close: () => Promise<void>;
    }>;
    close: () => Promise<void>;
  }> }).launch({ headless: true });

  try {
    const context = await browser.newContext({
      ...(config.ignoreSslErrors && { ignoreHTTPSErrors: true }),
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
    const html = await page.content();
    await page.close();
    await context.close();
    logger.info('Fetched via Playwright', { bytes: html.length });
    return { html, usedPlaywright: true };
  } finally {
    await browser.close();
  }
}
