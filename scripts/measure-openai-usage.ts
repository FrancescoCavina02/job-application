import { loadCVs, formatCVsForPrompt } from '../src/services/cvLoader.js';
import { buildInterestPrompt } from '../src/services/llmProvider.js';
import { createProvider } from '../src/services/llmProvider.js';
import { config } from '../src/config.js';

async function main() {
  const cvFiles = await loadCVs(config.cvDir);
  const cvMaterials = formatCVsForPrompt(cvFiles);
  const { systemPrompt, userPrompt } = buildInterestPrompt({
    companyUrl: 'https://www.braincreators.com/',
    parsedCompany: {
      rawText: 'Braincreators builds AI systems for industrial inspection and operational decision support.',
      structured: { company: 'Braincreators', emails: [] },
      warnings: [],
    } as any,
    cvMaterials,
    candidateWebsite: config.candidateWebsite,
  });

  const provider = createProvider(config);
  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey: config.openaiApiKey });

  const response = await client.chat.completions.create({
    model: config.llmModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    reasoning_effort: config.llmReasoningEffort as 'medium',
    max_completion_tokens: 256,
    stream: false,
  });

  console.log(JSON.stringify({
    model: config.llmModel,
    reasoningEffort: config.llmReasoningEffort,
    usage: response.usage,
    finishReason: response.choices[0]?.finish_reason,
    outputChars: response.choices[0]?.message?.content?.length ?? 0,
    promptChars: systemPrompt.length + userPrompt.length,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
