import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { logger } from '../utils/logger.js';

export interface ParsedCompany {
  rawText: string;
  structured: {
    company: string | null;
    emails: string[];
  };
  excerpt: string;
  usedReadability: boolean;
  warnings: string[];
}

export interface ParsedJob {
  rawText: string;
  structured: {
    company: string | null;
    title: string | null;
    location: string | null;
    remoteStatus: string | null;
    seniority: string | null;
    responsibilities: string[];
    requiredSkills: string[];
    preferredSkills: string[];
  };
  excerpt: string;
  usedReadability: boolean;
  warnings: string[];
}

/**
 * Parses raw HTML from a job posting page.
 * Uses Mozilla Readability for main-content extraction, then applies
 * heuristics to infer structured fields from the cleaned text.
 */
export function parseJobPage(html: string, url: string): ParsedJob {
  const warnings: string[] = [];

  // Extract company/title from a fresh DOM before Readability has a chance to mutate it.
  const metaDom = new JSDOM(html, { url });
  const company = extractCompany(metaDom.window.document, url);
  const title = extractTitle(metaDom.window.document);

  const { text: rawText, usedReadability } = extractTextFromHtml(html, url);

  if (!usedReadability) {
    warnings.push('Readability extraction produced minimal content — falling back to full body text.');
    logger.warn('Fell back to body text extraction', { chars: rawText.length });
  } else {
    logger.info('Readability extraction succeeded', { chars: rawText.length });
  }

  if (rawText.length < 200) {
    warnings.push('Extracted job content is very short — the page may require JavaScript rendering.');
  }

  const structured = {
    company,
    title,
    location: inferLocation(rawText),
    remoteStatus: inferRemoteStatus(rawText),
    seniority: inferSeniority(rawText),
    responsibilities: inferSection(rawText, RESPONSIBILITY_PATTERNS),
    requiredSkills: inferSection(rawText, REQUIRED_SKILL_PATTERNS),
    preferredSkills: inferSection(rawText, PREFERRED_SKILL_PATTERNS),
  };

  const excerpt = rawText;

  return { rawText, structured, excerpt, usedReadability, warnings };
}

// ---------------------------------------------------------------------------
// Exported helpers (reused by companyCrawler.ts)
// ---------------------------------------------------------------------------

/**
 * Extracts readable text from a raw HTML string.
 * Tries Mozilla Readability first; falls back to manual body-text stripping.
 * Creates its own JSDOM instances so callers do not need to share DOM state.
 */
export function extractTextFromHtml(html: string, url: string): { text: string; usedReadability: boolean } {
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (article?.textContent && article.textContent.trim().length > 200) {
    return { text: cleanText(article.textContent), usedReadability: true };
  }

  // Readability mutates the DOM when it runs; create a fresh instance for fallback.
  const freshDom = new JSDOM(html, { url });
  return { text: extractBodyText(freshDom.window.document), usedReadability: false };
}

// ---------------------------------------------------------------------------
// Field extractors
// ---------------------------------------------------------------------------

export function extractCompany(doc: Document, url: string): string | null {
  // Open Graph site name is the most reliable signal
  const og = doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content');
  if (og && og.trim().length > 0) return og.trim();

  // LinkedIn / Greenhouse / Lever structured data
  const jsonLd = extractJsonLd(doc);
  if (jsonLd?.hiringOrganization?.name) return jsonLd.hiringOrganization.name;

  // <title> often looks like "Job Title at Company | Job Board"
  const pageTitle = doc.title ?? '';
  const atMatch = pageTitle.match(/ (?:at|@) ([^|–\-]+)/i);
  if (atMatch?.[1]) return atMatch[1].trim();

  // Attempt to extract from the URL hostname
  const hostname = new URL(url).hostname.replace(/^www\./, '');
  const parts = hostname.split('.');
  // jobs.company.com or company.greenhouse.io etc.
  const knownBoards = ['greenhouse', 'lever', 'workable', 'ashby', 'recruitee', 'myworkday'];
  if (parts.length >= 2) {
    const tld = parts[parts.length - 2];
    if (tld && !knownBoards.includes(tld)) {
      return capitalize(tld);
    }
    // subdomain pattern: jobs.stripe.com
    if (parts[0] && ['jobs', 'careers', 'apply'].includes(parts[0]) && parts[1]) {
      return capitalize(parts[1]);
    }
  }

  return null;
}

function extractTitle(doc: Document): string | null {
  // Open Graph title
  const og = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
  if (og && og.trim().length > 0) return og.trim();

  // JSON-LD
  const jsonLd = extractJsonLd(doc);
  if (jsonLd?.title && typeof jsonLd.title === 'string') return jsonLd.title;

  // First <h1>
  const h1 = doc.querySelector('h1')?.textContent?.trim();
  if (h1 && h1.length > 0) return h1;

  // Page title (usually "Role - Company")
  const pageTitle = doc.title ?? '';
  const cleaned = pageTitle.split(/[|\-–—]/)[0]?.trim();
  return cleaned ?? null;
}

interface JobPostingJsonLd {
  '@type': string;
  title?: string;
  hiringOrganization?: { name?: string };
}

function extractJsonLd(doc: Document): JobPostingJsonLd | null {
  try {
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      const parsed = JSON.parse(script.textContent ?? '{}') as JobPostingJsonLd;
      if (parsed['@type'] === 'JobPosting') return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

function extractBodyText(doc: Document): string {
  // Remove noisy elements before grabbing text
  const remove = doc.querySelectorAll('nav, footer, header, aside, script, style, noscript, iframe, [role="navigation"], [role="banner"], [role="complementary"]');
  remove.forEach((el) => el.remove());
  return cleanText(doc.body?.textContent ?? '');
}

function cleanText(text: string): string {
  return text
    .replace(/\t/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------------------------------------------------------------------------
// Heuristic section inference
// ---------------------------------------------------------------------------

const RESPONSIBILITY_PATTERNS = [
  /responsibilities/i,
  /what you('ll| will) do/i,
  /your role/i,
  /the role/i,
  /day.to.day/i,
];

const REQUIRED_SKILL_PATTERNS = [
  /requirements/i,
  /required/i,
  /must have/i,
  /qualifications/i,
  /what you('ll| will) need/i,
  /what we('re| are) looking for/i,
];

const PREFERRED_SKILL_PATTERNS = [
  /nice.to.have/i,
  /preferred/i,
  /bonus/i,
  /plus/i,
  /desirable/i,
];

function inferSection(text: string, patterns: RegExp[]): string[] {
  const lines = text.split('\n');
  const results: string[] = [];
  let capturing = false;
  let captureCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (capturing) captureCount++;
      if (captureCount > 3) capturing = false; // section ended after 3+ blank lines
      continue;
    }

    const isHeader = patterns.some((p) => p.test(trimmed));
    if (isHeader) {
      capturing = true;
      captureCount = 0;
      continue;
    }

    if (capturing) {
      // Stop at a new section header that doesn't match our patterns
      if (looksLikeSectionHeader(trimmed) && !patterns.some((p) => p.test(trimmed))) {
        capturing = false;
        continue;
      }
      const cleaned = trimmed.replace(/^[•\-–—*►▸▶]\s*/, '').trim();
      if (cleaned.length > 5 && cleaned.length < 300) {
        results.push(cleaned);
      }
    }
  }

  return results.slice(0, 20); // cap at 20 items
}

function looksLikeSectionHeader(line: string): boolean {
  // All caps, short, or ends with colon
  return (
    (line === line.toUpperCase() && line.length > 3) ||
    line.endsWith(':') ||
    (line.length < 60 && /^[A-Z]/.test(line) && !line.includes('.'))
  );
}

function inferLocation(text: string): string | null {
  const match = text.match(
    /(?:location|based in|office)[:\s]+([A-Za-z\s,]+(?:,\s*[A-Za-z\s]+)?)/i
  );
  return match?.[1]?.trim() ?? null;
}

function inferRemoteStatus(text: string): string | null {
  if (/\bfully remote\b|\b100%\s*remote\b/i.test(text)) return 'fully remote';
  if (/\bhybrid\b/i.test(text)) return 'hybrid';
  if (/\bremote\b/i.test(text)) return 'remote';
  if (/\bon.?site\b|\bin.?office\b|\bin.?person\b/i.test(text)) return 'on-site';
  return null;
}

function inferSeniority(text: string): string | null {
  if (/\bstaff\b/i.test(text)) return 'staff';
  if (/\bprincipal\b/i.test(text)) return 'principal';
  if (/\bsenior\b|\bsr\.\b/i.test(text)) return 'senior';
  if (/\bjunior\b|\bjr\.\b/i.test(text)) return 'junior';
  if (/\bmid.?level\b|\bintermediate\b/i.test(text)) return 'mid-level';
  if (/\bintern\b|\bgraduate\b/i.test(text)) return 'entry-level';
  if (/\blead\b/i.test(text)) return 'lead';
  if (/\bdirector\b/i.test(text)) return 'director';
  if (/\bmanager\b/i.test(text)) return 'manager';
  return null;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Company page parser (for working-student interest applications)
// ---------------------------------------------------------------------------

/**
 * Parses a general company website (not a job posting).
 * Extracts emails from the raw HTML before Readability strips footer/contact
 * elements, then applies the same text-extraction logic as parseJobPage.
 */
export function parseCompanyPage(html: string, url: string): ParsedCompany {
  const warnings: string[] = [];

  const emails = extractEmails(html);

  const metaDom = new JSDOM(html, { url });
  const company = extractCompany(metaDom.window.document, url);

  const { text: rawText, usedReadability } = extractTextFromHtml(html, url);

  if (!usedReadability) {
    warnings.push('Readability extraction produced minimal content — falling back to full body text.');
    logger.warn('Fell back to body text extraction (company page)', { chars: rawText.length });
  } else {
    logger.info('Readability extraction succeeded (company page)', { chars: rawText.length });
  }

  if (rawText.length < 200) {
    warnings.push('Extracted company content is very short — the page may require JavaScript rendering.');
  }

  return {
    rawText,
    structured: { company, emails },
    excerpt: rawText,
    usedReadability,
    warnings,
  };
}

export function extractEmails(html: string): string[] {
  const EMAIL_PATTERN = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  // Asset file extensions that are not real email addresses
  const ASSET_EXTENSIONS = /\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|woff|ttf)$/i;

  const matches = html.match(EMAIL_PATTERN) ?? [];
  const unique = [...new Set(matches)].filter((e) => !ASSET_EXTENSIONS.test(e));
  return unique;
}
