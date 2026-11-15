import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { Pool, type PoolClient } from "pg";
import { PostgresDialect } from "kysely";
import { applicationSchema } from "./schema";
import { runtimeConfig } from "./config";

export const dataDirectory = resolve(
  /* turbopackIgnore: true */
  process.env.TWOSPACE_DATA_DIR || join(process.cwd(), "data"),
);
type TransactionContext = { client?: PoolClient; sqlite?: true };
const scope = new AsyncLocalStorage<TransactionContext>();
const globals = globalThis as unknown as {
  twospaceDb?: DatabaseSync;
  twospacePool?: Pool;
  twospaceSchemaReady?: Promise<void>;
  twospaceSqliteQueue?: Promise<void>;
};
let sqlite: DatabaseSync | undefined;
function postgresConnection() {
  if (!process.env.DATABASE_URL) return {};
  const url = new URL(process.env.DATABASE_URL);
  // Keep TLS certificate verification explicit rather than inheriting URL overrides.
  for (const option of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
    url.searchParams.delete(option);
  const localTest =
    process.env.NODE_ENV === "test" &&
    ["localhost", "127.0.0.1"].includes(url.hostname);
  return {
    connectionString: url.toString(),
    ssl: localTest
      ? false
      : {
          rejectUnauthorized: true,
          ...(process.env.DATABASE_SSL_CA
            ? { ca: process.env.DATABASE_SSL_CA.replace(/\\n/g, "\n") }
            : {}),
        },
  };
}
export const pool = runtimeConfig.cloud
  ? (globals.twospacePool ??= new Pool({
      ...postgresConnection(),
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    }))
  : undefined;
if (!runtimeConfig.cloud) {
  mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
  sqlite = globals.twospaceDb ??= new DatabaseSync(
    join(dataDirectory, "twospace.sqlite"),
    { timeout: 5000 },
  );
  chmodSync(join(dataDirectory, "twospace.sqlite"), 0o600);
  sqlite.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
}
export const authDatabase = pool
  ? {
      dialect: new PostgresDialect({ pool }),
      type: "postgres" as const,
      schemaName: "twospace",
    }
  : sqlite!;

/** SQL is application-owned. Values always remain separate bound parameters. */
export function postgresSql(sql: string): string {
  let parameter = 0;
  let result = sql.replace(
    /'(?:[^']|'')*'|"(?:[^"]|"")*"|\?|\b(?:profiles|spaces|memberships|invitations|resources|media|demo_rooms|demo_credentials|pair_history|media_deletions)\b/g,
    (part) => {
      if (part === "?") return `$${++parameter}`;
      if (part.startsWith("'") || part.startsWith('"')) return part;
      return `"twospace"."${part}"`;
    },
  );
  if (/^\s*INSERT OR IGNORE/i.test(result))
    result =
      result
        .replace(/INSERT OR IGNORE/i, "INSERT")
        .trim()
        .replace(/;$/, "") + " ON CONFLICT DO NOTHING";
  return result;
}
async function localLock<T>(fn: () => T | Promise<T>): Promise<T> {
  const previous = globals.twospaceSqliteQueue ?? Promise.resolve();
  let release!: () => void;
  globals.twospaceSqliteQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}
export function databaseReady(): Promise<void> {
  return (globals.twospaceSchemaReady ??= (async () => {
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtext('twospace-schema'))",
        );
        await client.query("CREATE SCHEMA IF NOT EXISTS twospace");
        await client.query(postgresSql(applicationSchema));
        // This schema is accessed only by the application server, never the public Data API.
        await client.query("REVOKE ALL ON SCHEMA twospace FROM PUBLIC");
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } else {
      sqlite!.exec(applicationSchema);
      const columns = sqlite!.prepare("PRAGMA table_info(resources)").all() as {
        name: string;
        pk: number;
      }[];
      if (columns.find((column) => column.name === "space_id")?.pk === 0) {
        sqlite!.exec(`BEGIN IMMEDIATE;
          CREATE TABLE resources_scoped (id TEXT NOT NULL, space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE, kind TEXT NOT NULL, author_id TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(space_id,id));
          INSERT INTO resources_scoped SELECT * FROM resources; DROP TABLE resources;
          ALTER TABLE resources_scoped RENAME TO resources;
          CREATE INDEX resources_space_kind ON resources(space_id,kind,created_at); COMMIT;`);
      }
    }
  })().catch((error) => {
    globals.twospaceSchemaReady = undefined;
    throw error;
  }));
}
export const id = () => randomUUID();
export const now = () => new Date().toISOString();
export async function rows<T>(
  sql: string,
  ...params: SQLInputValue[]
): Promise<T[]> {
  await databaseReady();
  const current = scope.getStore();
  if (pool)
    return (await (current?.client ?? pool).query(postgresSql(sql), params))
      .rows as T[];
  const read = () => sqlite!.prepare(sql).all(...params) as T[];
  return current?.sqlite ? read() : localLock(read);
}
export async function row<T>(
  sql: string,
  ...params: SQLInputValue[]
): Promise<T | undefined> {
  return (await rows<T>(sql, ...params))[0];
}
export async function execute(sql: string, ...params: SQLInputValue[]) {
  await databaseReady();
  const current = scope.getStore();
  if (pool)
    return (
      (await (current?.client ?? pool).query(postgresSql(sql), params))
        .rowCount ?? 0
    );
  const write = () => Number(sqlite!.prepare(sql).run(...params).changes);
  return current?.sqlite ? write() : localLock(write);
}
export async function transaction<T>(
  fn: () => T | Promise<T>,
  lockKey = "shared",
): Promise<T> {
  await databaseReady();
  if (scope.getStore()) return fn();
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        [lockKey],
      );
      const result = await scope.run({ client }, fn);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  return localLock(async () => {
    sqlite!.exec("BEGIN IMMEDIATE");
    try {
      const result = await scope.run({ sqlite: true }, fn);
      sqlite!.exec("COMMIT");
      return result;
    } catch (error) {
      sqlite!.exec("ROLLBACK");
      throw error;
    }
  });
}

export async function withAuthMigrationLock<T>(
  task: () => Promise<T>,
): Promise<T> {
  if (!pool) return task();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('twospace-auth-schema'))",
    );
    const result = await task();
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export type ResourceRow = {
  id: string;
  space_id: string;
  kind: string;
  author_id: string;
  body: string;
  created_at: string;
};
export async function resource<T>(
  spaceId: string,
  kind: string,
  resourceId: string,
): Promise<T | undefined> {
  const found = await row<ResourceRow>(
    "SELECT * FROM resources WHERE id=? AND space_id=? AND kind=?",
    resourceId,
    spaceId,
    kind,
  );
  return found ? (JSON.parse(found.body) as T) : undefined;
}
export async function resources<T>(
  spaceId: string,
  kind: string,
): Promise<T[]> {
  return (
    await rows<ResourceRow>(
      "SELECT * FROM resources WHERE space_id=? AND kind=? ORDER BY created_at DESC,id DESC",
      spaceId,
      kind,
    )
  ).map((item) => JSON.parse(item.body) as T);
}
export async function insertResource<T extends { id: string }>(
  spaceId: string,
  kind: string,
  authorId: string,
  value: T,
): Promise<T> {
  await execute(
    "INSERT INTO resources(id,space_id,kind,author_id,body,created_at) VALUES(?,?,?,?,?,?)",
    value.id,
    spaceId,
    kind,
    authorId,
    JSON.stringify(value),
    now(),
  );
  return value;
}
export async function updateResource<T extends { id: string }>(
  spaceId: string,
  kind: string,
  value: T,
): Promise<T> {
  await execute(
    "UPDATE resources SET body=? WHERE id=? AND space_id=? AND kind=?",
    JSON.stringify(value),
    value.id,
    spaceId,
    kind,
  );
  return value;
}
export async function closeDatabase() {
  if (pool) await pool.end();
  else sqlite?.close();
}
