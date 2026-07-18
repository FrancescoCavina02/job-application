import { JSDOM } from 'jsdom';
import { fetchJobPage } from './jobFetcher.js';
import { extractTextFromHtml, extractEmails, extractCompany } from './jobParser.js';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CrawledPage {
  url: string;
  label: string;
  text: string;
  emails: string[];
}

export interface CrawlResult {
  rootPage: CrawledPage;
  extraPages: CrawledPage[];
  combinedText: string;
  emails: string[];
  companyName: string | null;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ROOT_TEXT_CAP = 6_000;
const EXTRA_TEXT_CAP = 4_000;
const MAX_EXTRA_PAGES = 4;

// URL path keywords ordered by how useful the page is for understanding the company.
const SCORE_MAP: Array<{ keywords: string[]; score: number }> = [
  {
    score: 3,
    keywords: ['about', 'our-story', 'story', 'mission', 'values', 'culture', 'who-we-are', 'why-us'],
  },
  {
    score: 2,
    keywords: ['product', 'solution', 'platform', 'service', 'what-we-do', 'how-it-works', 'offering', 'features'],
  },
  {
    score: 1,
    keywords: ['team', 'people', 'careers', 'jobs', 'contact'],
  },
];

// Substrings that indicate a page we should skip entirely.
const SKIP_SUBSTRINGS = [
  'blog', 'news', 'press', 'legal', 'privacy', 'terms', 'cookie',
  'login', 'signin', 'signup', 'register', '404',
  'support', 'help', 'docs', 'documentation', 'faq',
  'investor', 'cdn-',
];

// File extensions that are not web pages.
const ASSET_EXT = /\.(css|js|png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|eot|pdf|xml|zip|mp4|mp3)(\?.*)?$/i;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function scorePathname(pathname: string): number {
  const lower = pathname.toLowerCase();
  if (ASSET_EXT.test(lower)) return 0;
  if (SKIP_SUBSTRINGS.some((s) => lower.includes(s))) return 0;
  for (const { score, keywords } of SCORE_MAP) {
    if (keywords.some((k) => lower.includes(k))) return score;
  }
  return 0;
}

function labelFromPathname(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  if (!last) return 'Home';
  return last
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .slice(0, 50);
}

interface ScoredLink {
  url: string;
  score: number;
  label: string;
}

function extractScoredLinks(html: string, baseUrl: string): ScoredLink[] {
  const origin = new URL(baseUrl).origin;
  const basePathname = new URL(baseUrl).pathname.replace(/\/$/, '') || '/';

  const dom = new JSDOM(html, { url: baseUrl });
  const anchors = dom.window.document.querySelectorAll('a[href]');

  const seen = new Set<string>();
  const links: ScoredLink[] = [];

  for (const anchor of anchors) {
    const href = anchor.getAttribute('href');
    if (!href) continue;

    let resolved: URL;
    try {
      resolved = new URL(href, baseUrl);
    } catch {
      continue;
    }

    if (resolved.origin !== origin) continue;

    // Normalise: strip query and hash, remove trailing slash
    const key = resolved.pathname.replace(/\/$/, '') || '/';
    if (key === basePathname || seen.has(key)) continue;
    seen.add(key);

    const score = scorePathname(resolved.pathname);
    if (score === 0) continue;

    links.push({
      url: `${resolved.origin}${resolved.pathname}`,
      score,
      label: labelFromPathname(resolved.pathname),
    });
  }

  links.sort((a, b) => b.score - a.score);
  return links;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Fetches the root URL and up to 4 high-value internal pages in parallel.
 * Returns combined text from all pages, deduplicated emails, and the company name.
 */
export async function crawlCompanyPages(url: string): Promise<CrawlResult> {
  const warnings: string[] = [];

  // Step 1: Fetch root page
  logger.info('Crawling root page', { url });
  const { html: rootHtml, usedPlaywright } = await fetchJobPage(url);
  if (usedPlaywright) {
    warnings.push('Used Playwright fallback for root page (JavaScript-heavy site).');
  }

  const rootEmails = extractEmails(rootHtml);
  const { text: rootRawText } = extractTextFromHtml(rootHtml, url);
  const rootText = rootRawText.slice(0, ROOT_TEXT_CAP);

  // Extract company name from the root page DOM (OG tags, JSON-LD, title, hostname).
  const rootDom = new JSDOM(rootHtml, { url });
  const companyName = extractCompany(rootDom.window.document, url);

  const rootPage: CrawledPage = { url, label: 'Home', text: rootText, emails: rootEmails };

  // Step 2: Score and select additional pages
  const candidates = extractScoredLinks(rootHtml, url);
  const selected = candidates.slice(0, MAX_EXTRA_PAGES);
  logger.info('Selected extra pages to crawl', {
    count: selected.length,
    pages: selected.map((p) => p.url),
  });

  // Step 3: Fetch extra pages in parallel; a failed page adds a warning and is skipped
  const fetchResults = await Promise.allSettled(
    selected.map(async ({ url: pageUrl, label }): Promise<CrawledPage> => {
      logger.info('Fetching extra page', { url: pageUrl });
      const { html: pageHtml } = await fetchJobPage(pageUrl);
      const pageEmails = extractEmails(pageHtml);
      const { text: pageRawText } = extractTextFromHtml(pageHtml, pageUrl);
      return {
        url: pageUrl,
        label,
        text: pageRawText.slice(0, EXTRA_TEXT_CAP),
        emails: pageEmails,
      };
    })
  );

  const extraPages: CrawledPage[] = [];
  for (const [i, result] of fetchResults.entries()) {
    if (result.status === 'fulfilled') {
      extraPages.push(result.value);
    } else {
      const pageUrl = selected[i]?.url ?? 'unknown';
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      warnings.push(`Failed to fetch page ${pageUrl}: ${reason}`);
      logger.warn('Failed to fetch extra page', { url: pageUrl, error: reason });
    }
  }

  if (extraPages.length === 0 && selected.length > 0) {
    warnings.push('All additional pages failed to load — only homepage content was used.');
  } else if (selected.length === 0) {
    warnings.push('No additional pages found to crawl — only homepage content was used.');
  }

  // Step 4: Combine text with labeled section headers
  const sections = [
    `=== Page: Home (${url}) ===\n${rootPage.text}`,
    ...extraPages.map((p) => `=== Page: ${p.label} (${p.url}) ===\n${p.text}`),
  ];

  const allEmails = [
    ...new Set([...rootEmails, ...extraPages.flatMap((p) => p.emails)]),
  ];

  logger.info('Crawl complete', {
    pagesTotal: 1 + extraPages.length,
    emailsFound: allEmails.length,
    combinedChars: sections.join('\n\n').length,
  });

  return {
    rootPage,
    extraPages,
    combinedText: sections.join('\n\n'),
    emails: allEmails,
    companyName,
    warnings,
  };
}
