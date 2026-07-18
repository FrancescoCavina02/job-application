import axios from 'axios';
import { spawn } from 'child_process';
import { logger } from '../utils/logger.js';

export interface PromptPostProcessorOptions {
  automationEnabled: boolean;
  chatGptUrl: string;
  chatGptModelName: string;
  browserBundleId: string;
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

function runCommand(command: string, args: string[], stdin?: string): Promise<{ success: boolean; stdout: string; stderr: string; message: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.on('error', (error) => resolve({ success: false, stdout, stderr, message: `${command} could not be started: ${error.message}` }));
    child.on('close', (code) => resolve({
      success: code === 0,
      stdout,
      stderr,
      message: code === 0 ? `${command} completed successfully.` : `${command} exited with code ${code}${stderr ? `: ${stderr}` : ''}`,
    }));
    child.stdin.end(stdin);
  });
}

async function openChatGptInComet(options: PromptPostProcessorOptions): Promise<{ success: boolean; message: string }> {
  const bundleResult = await runCommand('open', ['-b', options.browserBundleId, options.chatGptUrl]);
  if (bundleResult.success) return { success: true, message: `Opened ${options.chatGptUrl} with browser bundle ${options.browserBundleId}.` };

  const appResult = await runCommand('open', ['-a', 'Comet', options.chatGptUrl]);
  if (appResult.success) return { success: true, message: `Opened ${options.chatGptUrl} with Comet via open -a fallback.` };

  return {
    success: false,
    message: `Could not open Comet with either open -b ${options.browserBundleId} or open -a Comet. Bundle attempt: ${bundleResult.message}. App-name attempt: ${appResult.message}`,
  };
}

function escapeAppleScriptString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function chatGptHandoffAppleScript(options: PromptPostProcessorOptions): string {
  const bundleId = escapeAppleScriptString(options.browserBundleId);
  const modelName = escapeAppleScriptString(options.chatGptModelName);

  return `
set targetBundleId to "${bundleId}"
set targetModelName to "${modelName}"

tell application id targetBundleId to activate
delay 3

tell application "System Events"
  if UI elements enabled is false then error "macOS Accessibility permission is not enabled for the current terminal or Node runtime."

  tell process "Comet"
    set frontmost to true
    delay 1

    -- Best-effort ChatGPT temporary chat shortcut. If ChatGPT changes this shortcut,
    -- the later steps still run and failures are reported safely.
    keystroke "n" using {command down, shift down}
    delay 2

    set modelPickerClicked to false
    try
      set modelButtons to (buttons of entire contents of window 1 whose name contains "GPT" or description contains "GPT" or name contains "model" or description contains "model" or name contains "ChatGPT" or description contains "ChatGPT")
      if (count of modelButtons) > 0 then
        click item 1 of modelButtons
        set modelPickerClicked to true
      end if
    end try

    if modelPickerClicked is false then error "Could not find the ChatGPT model picker via Accessibility UI scripting."
    delay 1

    keystroke targetModelName
    delay 1
    key code 36
    delay 2

    keystroke "v" using {command down}
    delay 1
    key code 36
  end tell
end tell
`;
}

async function automateChatGpt(options: PromptPostProcessorOptions): Promise<{ success: boolean; message: string }> {
  const openResult = await openChatGptInComet(options);
  if (!openResult.success) return openResult;

  const scriptResult = await runCommand('osascript', ['-e', chatGptHandoffAppleScript(options)]);
  if (scriptResult.success) {
    return {
      success: true,
      message: `${openResult.message} Enabled temporary chat, selected ${options.chatGptModelName}, pasted the prompt from the clipboard, and submitted it via AppleScript/System Events.`,
    };
  }

  return {
    success: false,
    message: `${openResult.message} Prompt is on the clipboard, but AppleScript/System Events automation failed: ${scriptResult.message}. Grant macOS Accessibility permission to the terminal or Node runtime, then retry; otherwise paste manually in Comet.`,
  };
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
      const result = await automateChatGpt(options);
      browserResult = { attempted: true, ...result };
      if (!result.success) warnings.push(result.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      browserResult = {
        attempted: true,
        success: false,
        message: `ChatGPT browser automation could not start: ${message}. The prompt remains on the clipboard if pbcopy succeeded; grant macOS Accessibility permission to the terminal or Node runtime, then retry or paste manually in Comet.`,
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
