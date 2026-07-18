import { loadCVs, formatCVsForPrompt } from '../src/services/cvLoader.js';
import { buildPrompt, buildInterestPrompt } from '../src/services/llmProvider.js';
import { config } from '../src/config.js';

async function main() {
  const cvFiles = await loadCVs(config.cvDir);
  const cvMaterials = formatCVsForPrompt(cvFiles);

  const perCv = cvFiles
    .filter((f) => !f.skipped && f.content)
    .map((f) => ({ filename: f.filename, chars: f.content!.length }));

  const scenarios = [
    {
      label: 'interest_braincreators_size',
      build: () =>
        buildInterestPrompt({
          companyUrl: 'https://www.braincreators.com/',
          parsedCompany: {
            rawText: 'x'.repeat(1437),
            structured: { company: 'Braincreators', emails: [] },
            warnings: [],
          } as any,
          cvMaterials,
          candidateWebsite: config.candidateWebsite,
        }),
    },
    {
      label: 'job_medium_post_8k',
      build: () =>
        buildPrompt({
          jobUrl: 'https://example.com/job',
          parsedJob: {
            rawText: 'x'.repeat(8000),
            structured: { company: 'Example Co', title: 'Working Student' },
            warnings: [],
          } as any,
          cvMaterials,
          candidateWebsite: config.candidateWebsite,
        }),
    },
    {
      label: 'job_large_post_20k',
      build: () =>
        buildPrompt({
          jobUrl: 'https://example.com/job',
          parsedJob: {
            rawText: 'x'.repeat(20000),
            structured: { company: 'Example Co', title: 'Working Student' },
            warnings: [],
          } as any,
          cvMaterials,
          candidateWebsite: config.candidateWebsite,
        }),
    },
  ];

  let encode: (text: string) => number;
  try {
    const { encoding_for_model } = await import('js-tiktoken');
    const enc = encoding_for_model('gpt-4o');
    encode = (text: string) => enc.encode(text).length;
  } catch {
    encode = (text: string) => Math.ceil(text.length / 4);
  }

  console.log('Model config:', {
    provider: config.llmProvider,
    model: config.llmModel,
    reasoningEffort: config.llmReasoningEffort,
    cvFilesLoaded: perCv.length,
  });
  console.log('CV materials:', {
    totalChars: cvMaterials.length,
    estimatedTokens: encode(cvMaterials),
    perFile: perCv,
  });

  for (const scenario of scenarios) {
    const { systemPrompt, userPrompt } = scenario.build();
    const instructionsOnlyUser = userPrompt.replace(cvMaterials, '[CV_MATERIALS_PLACEHOLDER]');
    const jobOrCompanyTextMatch =
      scenario.label.startsWith('job')
        ? userPrompt.match(/Relevant extracted job posting content:\n([\s\S]*?)\n\nCandidate CV materials:/)
        : userPrompt.match(/Extracted company website content:\n([\s\S]*?)\n\nCandidate CV materials:/);
    const externalContextChars = jobOrCompanyTextMatch?.[1]?.length ?? 0;

    const systemTokens = encode(systemPrompt);
    const userTokens = encode(userPrompt);
    const instructionsTokens = encode(instructionsOnlyUser);

    console.log(
      JSON.stringify(
        {
          scenario: scenario.label,
          systemTokens,
          userTokens,
          totalInputTokens: systemTokens + userTokens,
          instructionsTokensExcludingCvs: instructionsTokens,
          cvMaterialsTokens: encode(cvMaterials),
          externalContextChars,
          systemChars: systemPrompt.length,
          userChars: userPrompt.length,
          instructionsCharsExcludingCvs: instructionsOnlyUser.length,
        },
        null,
        2,
      ),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
