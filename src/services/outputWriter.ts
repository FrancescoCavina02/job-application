import fs from 'fs';
import path from 'path';
import { sanitizeFilename } from '../utils/sanitize.js';
import { logger } from '../utils/logger.js';

export interface ParsedOutput {
  cv: string;
  motivationLetter: string;
  generationReport: string;
}

export interface SavedFiles {
  cvPath: string;
  letterPath: string;
  companyName: string;
}

/**
 * Parses the raw LLM response into the three sections:
 * ARTIFACT 1 (CV), ARTIFACT 2 (motivation letter), and the generation report.
 */
export function parseLLMResponse(response: string): ParsedOutput {
  // Locate artifact markers — case-insensitive, allow whitespace variation
  const art1Match = response.match(/ARTIFACT\s+1\s*:\s*TAILORED\s+CV\s*\n([\s\S]*?)(?=ARTIFACT\s+2\s*:|$)/i);
  const art2Match = response.match(/ARTIFACT\s+2\s*:\s*MOTIVATION\s+LETTER\s*\n([\s\S]*?)(?=GENERATION\s+REPORT|INTERNAL\s+GENERATION\s+REPORT|$)/i);
  const reportMatch = response.match(/(?:INTERNAL\s+)?GENERATION\s+REPORT\s*\n([\s\S]*?)$/i);

  if (!art1Match || !art2Match) {
    logger.warn('Could not find expected artifact markers in LLM response — using full response as CV');
    return {
      cv: response.trim(),
      motivationLetter: '',
      generationReport: '',
    };
  }

  return {
    cv: (art1Match[1] ?? '').trim(),
    motivationLetter: (art2Match[1] ?? '').trim(),
    generationReport: reportMatch ? (reportMatch[1] ?? '').trim() : '',
  };
}

/**
 * Saves the CV and motivation letter to the output directory.
 * Appends a timestamp if the target file already exists.
 */
export function saveOutputFiles(
  output: ParsedOutput,
  companyName: string,
  outputDir: string
): SavedFiles {
  const sanitized = sanitizeFilename(companyName || 'Unknown_Company');

  fs.mkdirSync(outputDir, { recursive: true });

  const cvPath = resolveOutputPath(outputDir, `CV_${sanitized}`, '.md');
  const letterPath = resolveOutputPath(outputDir, `Motivation-letter_${sanitized}`, '.md');

  fs.writeFileSync(cvPath, output.cv, 'utf-8');
  fs.writeFileSync(letterPath, output.motivationLetter, 'utf-8');

  logger.info('Saved output files', { cvPath, letterPath });

  return { cvPath, letterPath, companyName: sanitized };
}

function resolveOutputPath(dir: string, basename: string, ext: string): string {
  const target = path.join(dir, `${basename}${ext}`);
  if (!fs.existsSync(target)) return target;

  // File exists — append a timestamp to avoid silent overwrite
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return path.join(dir, `${basename}_${ts}${ext}`);
}
