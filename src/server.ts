import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './routes/api.js';
import { logger } from './utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(): ReturnType<typeof express> {
  const app = express();

  app.use(express.json());

  // Serve static frontend from /public (relative to project root, not src/)
  const publicDir = path.resolve(__dirname, '..', 'public');
  app.use(express.static(publicDir));

  // API routes
  app.use('/api', apiRouter);

  // Catch-all: serve index.html for any unmatched route (SPA support)
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled server error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
