import axios from 'axios';
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import { logger } from '../utils/logger.js';

export interface PromptPostProcessorOptions {
  automationEnabled: boolean;
  chatGptUrl: string;
  chatGptModelName: string;
}

export interface PromptPostProcessorResult {
  promptText: string;
  companyWebsite: string | null;
  warnings: string[];
  clipboard: { attempted: boolean; success: boolean; message: string };
  browserAutomation: { attempted: boolean; success: boolean; message: string };
}

const BLOCKED_HOST_PARTS = [
  'linkedin.', 'facebook.', 'instagram.', 'twitter.', 'x.com', 'wikipedia.', 'youtube.',
  'glassdoor.', 'indeed.', 'greenhouse.', 'lever.co', 'workdayjobs.', 'smartrecruiters.',
  'ashbyhq.', 'wellfound.', 'crunchbase.', 'bloomberg.', 'reuters.', 'google.', 'bing.',
];

function isReliableHomepage(candidate: string): boolean {
  try {
    const url = new URL(candidate);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    if (BLOCKED_HOST_PARTS.some((part) => host.includes(part))) return false;
    return true;
  } catch {
    return false;
  }
}

function toHomepage(candidate: string): string | null {
  try {
    const url = new URL(candidate);
    return `${url.protocol}//${url.hostname.replace(/^www\./, '')}`;
  } catch {
    return null;
  }
}

function extractDuckDuckGoResultUrls(html: string): string[] {
  const matches = html.matchAll(/uddg=([^&"']+)/g);
  return Array.from(matches, (match) => decodeURIComponent(match[1] ?? ''));
}

export async function findOfficialCompanyHomepage(companyName: string): Promise<string | null> {
  const normalized = companyName.trim();
  if (!normalized || normalized === 'Unknown Company' || normalized === 'Unknown_Company') return null;

  const response = await axios.get('https://html.duckduckgo.com/html/', {
    params: { q: `${normalized} official website` },
    timeout: 8000,
    headers: { 'User-Agent': 'Mozilla/5.0 job-application-automator' },
  });

  for (const resultUrl of extractDuckDuckGoResultUrls(String(response.data))) {
    if (!isReliableHomepage(resultUrl)) continue;
    const homepage = toHomepage(resultUrl);
    if (homepage) return homepage;
  }

  return null;
}

export function addCompanyWebsiteToPrompt(promptText: string, companyName: string, website: string | null): string {
  if (!website) return promptText;
  const companyLine = companyName.trim();
  if (!companyLine) return promptText;

  const escapedCompany = companyLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return promptText.replace(new RegExp(`(Company:\\n)${escapedCompany}(\\n)`, 'm'), `$1${companyLine} — ${website}$2`);
}

async function copyToMacClipboard(promptText: string): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    const child = spawn('pbcopy');
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.on('error', (error) => resolve({ success: false, message: `pbcopy could not be started: ${error.message}` }));
    child.on('close', (code) => {
      if (code === 0) resolve({ success: true, message: 'Prompt copied to the macOS clipboard with pbcopy.' });
      else resolve({ success: false, message: `pbcopy exited with code ${code}${stderr ? `: ${stderr}` : ''}` });
    });
    child.stdin.end(promptText);
  });
}

async function automateChatGpt(promptText: string, options: PromptPostProcessorOptions): Promise<{ success: boolean; message: string }> {
  const userDataDir = path.join(os.homedir(), '.job-application-chatgpt-playwright');
  const context = await chromium.launchPersistentContext(userDataDir, { headless: false });
  try {
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(options.chatGptUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    await page.getByText(/temporary/i).first().click({ timeout: 8000 }).catch(async () => {
      await page.getByRole('button', { name: /temporary|incognito/i }).click({ timeout: 8000 });
    });

    await page.getByRole('button', { name: /model|gpt|chatgpt/i }).first().click({ timeout: 8000 });
    await page.getByText(options.chatGptModelName, { exact: false }).click({ timeout: 10000 });

    const input = page.locator('textarea, [contenteditable="true"]').last();
    await input.click({ timeout: 15000 });
    await page.keyboard.insertText(promptText);
    return { success: true, message: `Opened ChatGPT, enabled temporary chat, selected ${options.chatGptModelName}, and pasted the prompt without sending.` };
  } catch (error) {
    await context.close().catch(() => undefined);
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, message: `ChatGPT browser automation failed: ${message}. Make sure Playwright Chromium is installed, you are logged in to ChatGPT, and macOS permissions allow browser automation if applicable.` };
  }
}

export async function postProcessGeneratedPrompt(
  promptText: string,
  companyName: string | null,
  options: PromptPostProcessorOptions,
): Promise<PromptPostProcessorResult> {
  const warnings: string[] = [];
  let companyWebsite: string | null = null;
  let enrichedPrompt = promptText;
  const company = companyName ?? 'Unknown Company';

  try {
    companyWebsite = await findOfficialCompanyHomepage(company);
    if (companyWebsite) enrichedPrompt = addCompanyWebsiteToPrompt(promptText, company, companyWebsite);
    else warnings.push(`No reliable official homepage found for "${company}"; leaving company name as-is.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`Company homepage lookup failed for "${company}": ${message}; leaving company name as-is.`);
  }

  const clipboardResult = await copyToMacClipboard(enrichedPrompt);
  if (!clipboardResult.success) warnings.push(`${clipboardResult.message}. Prompt will be returned and printed by the caller.`);

  let browserResult = { attempted: false, success: true, message: 'Browser automation disabled by configuration.' };
  if (options.automationEnabled) {
    logger.info('Starting ChatGPT browser automation');
    try {
      const result = await automateChatGpt(enrichedPrompt, options);
      browserResult = { attempted: true, ...result };
      if (!result.success) warnings.push(result.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      browserResult = {
        attempted: true,
        success: false,
        message: `ChatGPT browser automation could not start: ${message}. Run npx playwright install chromium, log in to ChatGPT in the Playwright browser profile, and grant macOS Accessibility/Automation permissions if prompted.`,
      };
      warnings.push(browserResult.message);
    }
  }

  return {
    promptText: enrichedPrompt,
    companyWebsite,
    warnings,
    clipboard: { attempted: true, ...clipboardResult },
    browserAutomation: browserResult,
  };
}
