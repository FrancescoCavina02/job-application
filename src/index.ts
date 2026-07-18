import { config } from './config.js';
import { createApp } from './server.js';
import { logger } from './utils/logger.js';

const app = createApp();

app.listen(config.port, () => {
  logger.info(`Job Application Automator running at http://localhost:${config.port}`);
  logger.info('Configuration', {
    provider: config.llmProvider,
    model: config.llmModel,
    cvDir: config.cvDir,
    outputDir: config.outputDir,
  });
});
