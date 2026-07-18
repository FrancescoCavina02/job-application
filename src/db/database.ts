import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

export interface ApplicationRecord {
  id?: number;
  jobUrl: string;
  timestamp: string;
  companyName: string | null;
  roleTitle: string | null;
  parsedContent: string;
  cvPath: string | null;
  letterPath: string | null;
  providerUsed: string;
  modelUsed: string;
  status: 'success' | 'error' | 'partial';
  errorsWarnings: string | null;
}

let db: ReturnType<typeof Database> | null = null;

export function getDb(dbPath: string): ReturnType<typeof Database> {
  if (db) return db;

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      job_url        TEXT    NOT NULL,
      timestamp      TEXT    NOT NULL,
      company_name   TEXT,
      role_title     TEXT,
      parsed_content TEXT    NOT NULL DEFAULT '',
      cv_path        TEXT,
      letter_path    TEXT,
      provider_used  TEXT    NOT NULL DEFAULT '',
      model_used     TEXT    NOT NULL DEFAULT '',
      status         TEXT    NOT NULL DEFAULT 'success',
      errors_warnings TEXT
    )
  `);

  logger.info('Database initialized', { dbPath });
  return db;
}

export function insertApplication(dbPath: string, record: ApplicationRecord): number {
  const conn = getDb(dbPath);
  const stmt = conn.prepare(`
    INSERT INTO applications
      (job_url, timestamp, company_name, role_title, parsed_content,
       cv_path, letter_path, provider_used, model_used, status, errors_warnings)
    VALUES
      (@jobUrl, @timestamp, @companyName, @roleTitle, @parsedContent,
       @cvPath, @letterPath, @providerUsed, @modelUsed, @status, @errorsWarnings)
  `);
  const result = stmt.run(record);
  return result.lastInsertRowid as number;
}

export function getAllApplications(dbPath: string): ApplicationRecord[] {
  const conn = getDb(dbPath);
  const rows = conn.prepare('SELECT * FROM applications ORDER BY id DESC').all() as Array<Record<string, unknown>>;
  return rows.map(toCamelCase);
}

function toCamelCase(row: Record<string, unknown>): ApplicationRecord {
  return {
    id: row['id'] as number,
    jobUrl: row['job_url'] as string,
    timestamp: row['timestamp'] as string,
    companyName: row['company_name'] as string | null,
    roleTitle: row['role_title'] as string | null,
    parsedContent: row['parsed_content'] as string,
    cvPath: row['cv_path'] as string | null,
    letterPath: row['letter_path'] as string | null,
    providerUsed: row['provider_used'] as string,
    modelUsed: row['model_used'] as string,
    status: row['status'] as ApplicationRecord['status'],
    errorsWarnings: row['errors_warnings'] as string | null,
  };
}
