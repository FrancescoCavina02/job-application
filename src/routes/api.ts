import { Router, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { fetchJobPage } from '../services/jobFetcher.js';
import { parseJobPage, type ParsedCompany } from '../services/jobParser.js';
import { crawlCompanyPages } from '../services/companyCrawler.js';
import { createProvider, buildPrompt, buildInterestPrompt } from '../services/llmProvider.js';
import { parseLLMResponse, saveOutputFiles } from '../services/outputWriter.js';
import { insertApplication, getAllApplications } from '../db/database.js';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Helper: merge system + user prompts into a single copy-pasteable string
// ---------------------------------------------------------------------------

function mergePromptText(systemPrompt: string, userPrompt: string): string {
  return `=== SYSTEM INSTRUCTIONS ===\n\n${systemPrompt}\n\n=== USER REQUEST ===\n\n${userPrompt}`;
}

// ---------------------------------------------------------------------------
// Helper: save prompt text to output/prompts/<slug>_prompt_<timestamp>.txt
// ---------------------------------------------------------------------------

function savePromptFile(promptText: string, slug: string, outputDir: string): string {
  const promptsDir = path.join(outputDir, 'prompts');
  if (!fs.existsSync(promptsDir)) fs.mkdirSync(promptsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${slug}_prompt_${ts}.txt`;
  const filepath = path.join(promptsDir, filename);
  fs.writeFileSync(filepath, promptText, 'utf-8');
  return filepath;
}

const router = Router();

// GET /api/cv-files — CV source info (LaTeX CV is now embedded in the prompt builder)
router.get('/cv-files', async (_req: Request, res: Response) => {
  res.json({
    cvDir: config.cvDir,
    source: 'embedded-latex',
    note: 'The CV is now provided as an embedded LaTeX document in the prompt builder. PDF files in the CVs directory are no longer used for generation.',
    files: [
      {
        filename: 'Francesco_Cavina_CV.tex (embedded)',
        format: 'tex',
        skipped: false,
        skipReason: null,
        chars: null,
      },
    ],
  });
});

// GET /api/history — list past generation runs from SQLite
router.get('/history', (_req: Request, res: Response) => {
  try {
    const records = getAllApplications(config.dbPath);
    res.json(records);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Failed to load history', { error: msg });
    res.status(500).json({ error: msg });
  }
});

// POST /api/generate — main pipeline endpoint
router.post('/generate', async (req: Request, res: Response) => {
  const { url } = req.body as { url?: string };

  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    res.status(400).json({ error: 'A valid job posting URL is required.' });
    return;
  }

  const startedAt = new Date().toISOString();
  const warnings: string[] = [];
  let dbId: number | undefined;

  try {
    // Step 1: Fetch the job page
    logger.info('Pipeline start', { url });
    const { html, usedPlaywright } = await fetchJobPage(url);
    if (usedPlaywright) warnings.push('Used Playwright fallback to render the page (JavaScript-heavy site).');

    // Step 2: Parse the job page
    const parsedJob = parseJobPage(html, url);
    warnings.push(...parsedJob.warnings);

    // Step 3: Build the prompt and call the LLM
    const provider = createProvider(config);
    const { systemPrompt, userPrompt } = buildPrompt({
      jobUrl: url,
      parsedJob,
      candidateWebsite: config.candidateWebsite,
    });

    logger.info('Sending request to LLM', { provider: provider.providerName, model: provider.modelName });
    const rawResponse = await provider.generate(systemPrompt, userPrompt);

    // Step 5: Parse the LLM response
    const parsedOutput = parseLLMResponse(rawResponse);

    const company = parsedJob.structured.company ?? 'Unknown_Company';

    // Step 6: Save output files
    const saved = saveOutputFiles(parsedOutput, company, config.outputDir);

    // Step 7: Persist to database
    dbId = insertApplication(config.dbPath, {
      jobUrl: url,
      timestamp: startedAt,
      companyName: parsedJob.structured.company,
      roleTitle: parsedJob.structured.title,
      parsedContent: parsedJob.rawText.slice(0, 5000),
      cvPath: saved.cvPath,
      letterPath: saved.letterPath,
      providerUsed: provider.providerName,
      modelUsed: provider.modelName,
      status: 'success',
      errorsWarnings: warnings.length ? warnings.join('\n') : null,
    });

    logger.info('Pipeline complete', { dbId, cvPath: saved.cvPath, letterPath: saved.letterPath });

    res.json({
      success: true,
      id: dbId,
      company: parsedJob.structured.company,
      role: parsedJob.structured.title,
      location: parsedJob.structured.location,
      remoteStatus: parsedJob.structured.remoteStatus,
      seniority: parsedJob.structured.seniority,
      jobExcerpt: parsedJob.excerpt,
      cvPath: saved.cvPath,
      letterPath: saved.letterPath,
      generationReport: parsedOutput.generationReport,
      warnings,
      provider: provider.providerName,
      model: provider.modelName,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Pipeline failed', { error: msg, url });

    // Persist failure record
    try {
      insertApplication(config.dbPath, {
        jobUrl: url,
        timestamp: startedAt,
        companyName: null,
        roleTitle: null,
        parsedContent: '',
        cvPath: null,
        letterPath: null,
        providerUsed: config.llmProvider,
        modelUsed: config.llmModel,
        status: 'error',
        errorsWarnings: msg,
      });
    } catch {
      // best-effort only
    }

    res.status(500).json({ error: msg, warnings });
  }
});

// POST /api/generate-interest — working student interest application pipeline
router.post('/generate-interest', async (req: Request, res: Response) => {
  const { url } = req.body as { url?: string };

  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    res.status(400).json({ error: 'A valid company website URL is required.' });
    return;
  }

  const startedAt = new Date().toISOString();
  const warnings: string[] = [];
  let dbId: number | undefined;

  try {
    // Steps 1–2: Crawl company website (root page + up to 4 high-value sub-pages in parallel)
    logger.info('Interest pipeline start', { url });
    const crawlResult = await crawlCompanyPages(url);
    warnings.push(...crawlResult.warnings);

    // Build a ParsedCompany from the multi-page crawl result
    const parsedCompany: ParsedCompany = {
      rawText: crawlResult.combinedText,
      structured: {
        company: crawlResult.companyName,
        emails: crawlResult.emails,
      },
      excerpt: crawlResult.rootPage.text.slice(0, 1500),
      usedReadability: true,
      warnings: [],
    };

    // Step 3: Build prompt and call LLM
    const provider = createProvider(config);
    const { systemPrompt, userPrompt } = buildInterestPrompt({
      companyUrl: url,
      parsedCompany,
      candidateWebsite: config.candidateWebsite,
    });

    logger.info('Sending interest request to LLM', { provider: provider.providerName, model: provider.modelName });
    const rawResponse = await provider.generate(systemPrompt, userPrompt);

    // Step 5: Parse the LLM response
    const parsedOutput = parseLLMResponse(rawResponse);

    // Extract contact email from generation report
    const emailMatch = parsedOutput.generationReport?.match(/CONTACT EMAIL:\s*([^\s\n]+)/i);
    const contactEmail = emailMatch?.[1] && emailMatch[1].toLowerCase() !== 'none' ? emailMatch[1] : null;

    const company = parsedCompany.structured.company ?? 'Unknown_Company';

    // Step 6: Save output files
    const saved = saveOutputFiles(parsedOutput, company, config.outputDir);

    // Step 7: Persist to database
    dbId = insertApplication(config.dbPath, {
      jobUrl: url,
      timestamp: startedAt,
      companyName: parsedCompany.structured.company,
      roleTitle: 'Working Student (16-24h/week)',
      parsedContent: parsedCompany.rawText.slice(0, 5000),
      cvPath: saved.cvPath,
      letterPath: saved.letterPath,
      providerUsed: provider.providerName,
      modelUsed: provider.modelName,
      status: 'success',
      errorsWarnings: warnings.length ? warnings.join('\n') : null,
    });

    logger.info('Interest pipeline complete', { dbId, cvPath: saved.cvPath, letterPath: saved.letterPath });

    res.json({
      success: true,
      id: dbId,
      company: parsedCompany.structured.company,
      companyExcerpt: parsedCompany.excerpt,
      pagesCrawled: 1 + crawlResult.extraPages.length,
      contactEmail,
      emailsFound: parsedCompany.structured.emails,
      cvPath: saved.cvPath,
      letterPath: saved.letterPath,
      generationReport: parsedOutput.generationReport,
      warnings,
      provider: provider.providerName,
      model: provider.modelName,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Interest pipeline failed', { error: msg, url });

    try {
      insertApplication(config.dbPath, {
        jobUrl: url,
        timestamp: startedAt,
        companyName: null,
        roleTitle: 'Working Student (16-24h/week)',
        parsedContent: '',
        cvPath: null,
        letterPath: null,
        providerUsed: config.llmProvider,
        modelUsed: config.llmModel,
        status: 'error',
        errorsWarnings: msg,
      });
    } catch {
      // best-effort only
    }

    res.status(500).json({ error: msg, warnings });
  }
});

// POST /api/create-prompt — build the full job-posting prompt without calling the LLM
router.post('/create-prompt', async (req: Request, res: Response) => {
  const { url } = req.body as { url?: string };

  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    res.status(400).json({ error: 'A valid job posting URL is required.' });
    return;
  }

  const warnings: string[] = [];

  try {
    logger.info('Create-prompt pipeline start', { url });

    // Step 1: Fetch the job page
    const { html, usedPlaywright } = await fetchJobPage(url);
    if (usedPlaywright) warnings.push('Used Playwright fallback to render the page (JavaScript-heavy site).');

    // Step 2: Parse the job page
    const parsedJob = parseJobPage(html, url);
    warnings.push(...parsedJob.warnings);

    // Step 3: Build the prompt (NO LLM call)
    const { systemPrompt, userPrompt } = buildPrompt({
      jobUrl: url,
      parsedJob,
      candidateWebsite: config.candidateWebsite,
    });

    const promptText = mergePromptText(systemPrompt, userPrompt);

    // Step 5: Save prompt file to output/prompts/
    const company = parsedJob.structured.company ?? 'Unknown_Company';
    const slug = company.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const savedPath = savePromptFile(promptText, slug, config.outputDir);

    logger.info('Create-prompt complete', { savedPath });

    res.json({
      success: true,
      company: parsedJob.structured.company,
      role: parsedJob.structured.title,
      promptText,
      savedPath,
      charCount: promptText.length,
      warnings,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Create-prompt pipeline failed', { error: msg, url });
    res.status(500).json({ error: msg, warnings });
  }
});

// POST /api/create-interest-prompt — build the full interest prompt without calling the LLM
router.post('/create-interest-prompt', async (req: Request, res: Response) => {
  const { url } = req.body as { url?: string };

  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    res.status(400).json({ error: 'A valid company website URL is required.' });
    return;
  }

  const warnings: string[] = [];

  try {
    logger.info('Create-interest-prompt pipeline start', { url });

    // Steps 1–2: Crawl company website
    const crawlResult = await crawlCompanyPages(url);
    warnings.push(...crawlResult.warnings);

    const parsedCompany: ParsedCompany = {
      rawText: crawlResult.combinedText,
      structured: {
        company: crawlResult.companyName,
        emails: crawlResult.emails,
      },
      excerpt: crawlResult.rootPage.text.slice(0, 1500),
      usedReadability: true,
      warnings: [],
    };

    // Step 3: Build the prompt (NO LLM call)
    const { systemPrompt, userPrompt } = buildInterestPrompt({
      companyUrl: url,
      parsedCompany,
      candidateWebsite: config.candidateWebsite,
    });

    const promptText = mergePromptText(systemPrompt, userPrompt);

    // Step 5: Save prompt file to output/prompts/
    const company = parsedCompany.structured.company ?? 'Unknown_Company';
    const slug = company.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const savedPath = savePromptFile(promptText, slug, config.outputDir);

    logger.info('Create-interest-prompt complete', { savedPath });

    res.json({
      success: true,
      company: parsedCompany.structured.company,
      promptText,
      savedPath,
      charCount: promptText.length,
      pagesCrawled: 1 + crawlResult.extraPages.length,
      warnings,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Create-interest-prompt pipeline failed', { error: msg, url });
    res.status(500).json({ error: msg, warnings });
  }
});

export { router as apiRouter };
