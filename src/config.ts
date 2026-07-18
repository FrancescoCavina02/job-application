import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(projectRoot, '.env') });

export type LLMProvider = 'openai' | 'anthropic';

export interface Config {
  llmProvider: LLMProvider;
  openaiApiKey: string | undefined;
  anthropicApiKey: string | undefined;
  llmModel: string;
  llmReasoningEffort: string;
  outputDir: string;
  cvDir: string;
  candidateWebsite: string;
  port: number;
  ignoreSslErrors: boolean;
  projectRoot: string;
  dbPath: string;
  promptAutomationEnabled: boolean;
  chatGptUrl: string;
  chatGptModelName: string;
  browserBundleId: string;
}

function resolveDir(envValue: string | undefined, defaultRelative: string): string {
  const raw = envValue ?? defaultRelative;
  return path.isAbsolute(raw) ? raw : path.resolve(projectRoot, raw);
}

function loadConfig(): Config {
  const provider = (process.env['LLM_PROVIDER'] ?? 'openai').toLowerCase();
  if (provider !== 'openai' && provider !== 'anthropic') {
    throw new Error(`LLM_PROVIDER must be "openai" or "anthropic", got: "${provider}"`);
  }

  return {
    llmProvider: provider as LLMProvider,
    openaiApiKey: process.env['OPENAI_API_KEY'],
    anthropicApiKey: process.env['ANTHROPIC_API_KEY'],
    llmModel: process.env['LLM_MODEL'] ?? 'gpt-4o',
    llmReasoningEffort: process.env['LLM_REASONING_EFFORT'] ?? 'medium',
    outputDir: resolveDir(process.env['OUTPUT_DIR'], '.'),
    cvDir: resolveDir(process.env['CV_DIR'], 'CVs'),
    candidateWebsite: process.env['CANDIDATE_WEBSITE'] ?? 'https://francesco-cavina.netlify.app/',
    port: parseInt(process.env['PORT'] ?? '3000', 10),
    ignoreSslErrors: process.env['IGNORE_SSL_ERRORS'] === 'true',
    projectRoot,
    dbPath: path.join(projectRoot, 'data', 'applications.db'),
    promptAutomationEnabled: process.env['PROMPT_AUTOMATION_ENABLED'] !== 'false',
    chatGptUrl: process.env['CHATGPT_URL'] ?? 'https://chatgpt.com/',
    chatGptModelName: process.env['CHATGPT_MODEL_NAME'] ?? 'GPT 5.6 SOL high',
    browserBundleId: process.env['PROMPT_AUTOMATION_BROWSER_BUNDLE_ID'] ?? 'ai.perplexity.comet',
  };
}

export const config = loadConfig();
