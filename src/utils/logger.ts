const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type Level = keyof typeof LEVELS;

const currentLevel: Level = (process.env['LOG_LEVEL'] as Level) ?? 'info';

function shouldLog(level: Level): boolean {
  return LEVELS[level] >= LEVELS[currentLevel];
}

function format(level: Level, message: string, data?: unknown): string {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level.toUpperCase()}]`;
  if (data !== undefined) {
    const extra = typeof data === 'object' ? JSON.stringify(data, null, 0) : String(data);
    return `${prefix} ${message} ${extra}`;
  }
  return `${prefix} ${message}`;
}

export const logger = {
  debug(message: string, data?: unknown): void {
    if (shouldLog('debug')) console.debug(format('debug', message, data));
  },
  info(message: string, data?: unknown): void {
    if (shouldLog('info')) console.info(format('info', message, data));
  },
  warn(message: string, data?: unknown): void {
    if (shouldLog('warn')) console.warn(format('warn', message, data));
  },
  error(message: string, data?: unknown): void {
    if (shouldLog('error')) console.error(format('error', message, data));
  },
};
