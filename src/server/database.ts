import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';

export const dataDirectory = resolve(process.env.TWOSPACE_DATA_DIR || join(process.cwd(), 'data'));
mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
const globals = globalThis as unknown as { twospaceDb?: DatabaseSync };
export const db = globals.twospaceDb ??= new DatabaseSync(join(dataDirectory, 'twospace.sqlite'), { timeout: 5000 });
chmodSync(join(dataDirectory, 'twospace.sqlite'), 0o600);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS profiles (
    user_id TEXT PRIMARY KEY, name TEXT NOT NULL, time_zone TEXT NOT NULL DEFAULT 'America/Chicago',
    color TEXT NOT NULL DEFAULT '#416B67', available_from INTEGER NOT NULL DEFAULT 18,
    available_to INTEGER NOT NULL DEFAULT 22, is_demo INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS spaces (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL, is_demo INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS memberships (
    user_id TEXT PRIMARY KEY, space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    slot INTEGER NOT NULL CHECK(slot IN (1,2)), UNIQUE(space_id,slot)
  );
  CREATE TABLE IF NOT EXISTS invitations (
    token_hash TEXT PRIMARY KEY, space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS resources (
    id TEXT NOT NULL, space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    kind TEXT NOT NULL, author_id TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL,
    PRIMARY KEY(space_id,id)
  );
  CREATE INDEX IF NOT EXISTS resources_space_kind ON resources(space_id,kind,created_at);
  CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY, space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    owner_id TEXT NOT NULL, filename TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS demo_rooms (
    token_hash TEXT PRIMARY KEY, space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS demo_credentials (
    user_id TEXT PRIMARY KEY, email TEXT NOT NULL, credential TEXT NOT NULL,
    space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE
  );
`);

// Curated activity IDs repeat across spaces. Their persisted state belongs to a space.
const resourceColumns = db.prepare('PRAGMA table_info(resources)').all() as { name: string; pk: number }[];
if (resourceColumns.find(column => column.name === 'space_id')?.pk === 0) {
  db.exec(`
    BEGIN IMMEDIATE;
    CREATE TABLE resources_scoped (
      id TEXT NOT NULL, space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
      kind TEXT NOT NULL, author_id TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL,
      PRIMARY KEY(space_id,id)
    );
    INSERT INTO resources_scoped SELECT * FROM resources;
    DROP TABLE resources;
    ALTER TABLE resources_scoped RENAME TO resources;
    CREATE INDEX resources_space_kind ON resources(space_id,kind,created_at);
    COMMIT;
  `);
}

export const id = () => randomUUID();
export const now = () => new Date().toISOString();
export function row<T>(sql: string, ...params: SQLInputValue[]): T | undefined { return db.prepare(sql).get(...params) as T | undefined; }
export function rows<T>(sql: string, ...params: SQLInputValue[]): T[] { return db.prepare(sql).all(...params) as T[]; }
export function transaction<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try { const result = fn(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
export type ResourceRow = { id: string; space_id: string; kind: string; author_id: string; body: string; created_at: string };
export function resource<T>(spaceId: string, kind: string, resourceId: string): T | undefined {
  const found = row<ResourceRow>('SELECT * FROM resources WHERE id=? AND space_id=? AND kind=?', resourceId, spaceId, kind);
  return found ? JSON.parse(found.body) as T : undefined;
}
export function resources<T>(spaceId: string, kind: string): T[] {
  return rows<ResourceRow>('SELECT * FROM resources WHERE space_id=? AND kind=? ORDER BY created_at DESC,id DESC', spaceId, kind).map(item => JSON.parse(item.body) as T);
}
export function insertResource<T extends { id: string }>(spaceId: string, kind: string, authorId: string, value: T): T {
  db.prepare('INSERT INTO resources(id,space_id,kind,author_id,body,created_at) VALUES(?,?,?,?,?,?)').run(value.id, spaceId, kind, authorId, JSON.stringify(value), now());
  return value;
}
export function updateResource<T extends { id: string }>(spaceId: string, kind: string, value: T): T {
  db.prepare('UPDATE resources SET body=? WHERE id=? AND space_id=? AND kind=?').run(JSON.stringify(value), value.id, spaceId, kind);
  return value;
}
