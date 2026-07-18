import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

export interface CVFile {
  filename: string;
  filepath: string;
  format: 'pdf' | 'docx' | 'txt' | 'md' | 'other';
  content: string | null;
  skipped: boolean;
  skipReason: string | null;
}

const SUPPORTED_FORMATS = new Set(['.pdf', '.docx', '.txt', '.md', '.markdown']);

/**
 * Reads all files from the CVs directory and parses their text content.
 * Supported: PDF, DOCX, TXT, Markdown.
 * Unsupported types are recorded with a skip reason.
 */
export async function loadCVs(cvDir: string): Promise<CVFile[]> {
  if (!fs.existsSync(cvDir)) {
    logger.warn('CV directory does not exist', { cvDir });
    return [];
  }

  const entries = fs.readdirSync(cvDir).filter((f) => !f.startsWith('.'));
  if (entries.length === 0) {
    logger.warn('CV directory is empty', { cvDir });
    return [];
  }

  logger.info('Loading CV files', { count: entries.length, cvDir });

  const results: CVFile[] = [];
  for (const filename of entries) {
    const filepath = path.join(cvDir, filename);
    const stat = fs.statSync(filepath);
    if (stat.isDirectory()) continue;

    const ext = path.extname(filename).toLowerCase();
    const result = await parseCVFile(filename, filepath, ext);
    results.push(result);
  }

  const loaded = results.filter((r) => !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  logger.info('CV loading complete', { loaded, skipped });

  return results;
}

async function parseCVFile(filename: string, filepath: string, ext: string): Promise<CVFile> {
  if (!SUPPORTED_FORMATS.has(ext)) {
    return {
      filename,
      filepath,
      format: 'other',
      content: null,
      skipped: true,
      skipReason: `Unsupported file type "${ext}". Supported: PDF, DOCX, TXT, Markdown.`,
    };
  }

  try {
    if (ext === '.pdf') {
      return await parsePDF(filename, filepath);
    }
    if (ext === '.docx') {
      return await parseDOCX(filename, filepath);
    }
    // .txt, .md, .markdown
    return parsePlainText(filename, filepath, ext === '.pdf' ? 'pdf' : ext === '.docx' ? 'docx' : ext === '.md' || ext === '.markdown' ? 'md' : 'txt');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Failed to parse CV file', { filename, error: msg });
    return {
      filename,
      filepath,
      format: ext === '.pdf' ? 'pdf' : ext === '.docx' ? 'docx' : 'txt',
      content: null,
      skipped: true,
      skipReason: `Parse error: ${msg}`,
    };
  }
}

async function parsePDF(filename: string, filepath: string): Promise<CVFile> {
  // pdf-parse has an awkward ESM compat situation — use dynamic import
  const pdfParse = (await import('pdf-parse')).default;
  const buffer = fs.readFileSync(filepath);
  const data = await pdfParse(buffer);
  const content = data.text.replace(/\n{3,}/g, '\n\n').trim();
  logger.debug('Parsed PDF', { filename, chars: content.length });
  return { filename, filepath, format: 'pdf', content, skipped: false, skipReason: null };
}

async function parseDOCX(filename: string, filepath: string): Promise<CVFile> {
  const mammoth = await import('mammoth');
  const buffer = fs.readFileSync(filepath);
  const result = await mammoth.extractRawText({ buffer });
  const content = result.value.replace(/\n{3,}/g, '\n\n').trim();
  logger.debug('Parsed DOCX', { filename, chars: content.length });
  return { filename, filepath, format: 'docx', content, skipped: false, skipReason: null };
}

function parsePlainText(filename: string, filepath: string, format: CVFile['format']): CVFile {
  const content = fs.readFileSync(filepath, 'utf-8').replace(/\n{3,}/g, '\n\n').trim();
  logger.debug('Parsed plain text', { filename, chars: content.length });
  return { filename, filepath, format, content, skipped: false, skipReason: null };
}

/**
 * Formats loaded CV files into a single string block suitable for the LLM prompt.
 */
export function formatCVsForPrompt(cvFiles: CVFile[]): string {
  const loaded = cvFiles.filter((f) => !f.skipped && f.content);
  if (loaded.length === 0) return '[No CV files could be loaded]';

  return loaded
    .map((f) => `--- CV File: ${f.filename} ---\n${f.content}`)
    .join('\n\n');
}
