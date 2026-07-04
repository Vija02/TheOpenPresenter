import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import type { Logger } from "pino";

/**
 * Per-plugin Postgres storage.
 *
 * Each plugin gets its own schema (`plugin_<sanitized_name>`) and ships its own
 * forward-only SQL migrations under a `migrations/` folder. Migration state is
 * tracked per-plugin inside the plugin's own schema (`__migrations` table), so
 * plugins have fully independent migration streams
 *
 * Plugins read/write them through `getPluginDb()` using the root (owner) pool.
 */

export interface RegisteredMigration {
  pluginName: string;
  migrationsPath: string;
}

const quoteIdent = (identifier: string): string =>
  `"${identifier.replace(/"/g, '""')}"`;

export const pluginSchemaName = (pluginName: string): string => {
  const sanitized = pluginName
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!sanitized) {
    throw new Error(
      `Cannot derive a Postgres schema name from plugin "${pluginName}"`,
    );
  }

  return `plugin_${sanitized}`.slice(0, 63);
};

const pluginSearchPath = (schema: string): string =>
  `${quoteIdent(schema)}, app_public, public`;

// ---------------------------------------------------------------------------
// Runtime data access
// ---------------------------------------------------------------------------

export interface PluginDb {
  /** The plugin's dedicated schema, e.g. "plugin_lyrics_presenter". */
  readonly schema: string;
  /** Run a single query with search_path scoped to the plugin schema. */
  query<T extends QueryResultRow = any>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
  /** Check out a client with search_path scoped to the plugin schema. */
  withClient<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
  /** Like withClient, wrapped in a BEGIN/COMMIT (ROLLBACK on throw). */
  withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
}

export const createPluginDb = (pool: Pool, pluginName: string): PluginDb => {
  const schema = pluginSchemaName(pluginName);
  const searchPath = pluginSearchPath(schema);

  const withClient = async <T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> => {
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO ${searchPath}`);
      return await callback(client);
    } finally {
      // Reset so we never poison a pooled connection for the next borrower.
      try {
        await client.query("SET search_path TO DEFAULT");
      } catch {
        // ignore — the connection is being released regardless
      }
      client.release();
    }
  };

  const withTransaction = async <T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> =>
    withClient(async (client) => {
      await client.query("BEGIN");
      try {
        const result = await callback(client);
        await client.query("COMMIT");
        return result;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    });

  const query = async <T extends QueryResultRow = any>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> =>
    withClient((client) => client.query<T>(text, params));

  return { schema, query, withClient, withTransaction };
};

// ---------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------

// First key of the two-int advisory lock. A fixed namespace ("plgm") so plugin
// migration locks never collide with unrelated advisory locks in the app.
const ADVISORY_LOCK_NAMESPACE = 0x706c676d;

// Matches "0001_init.sql", "0001-init.sql", "0002_add_tags.sql", etc.
const MIGRATION_FILE_RE = /^\d+[-_].*\.sql$/;

interface MigrationFile {
  filename: string;
  fullPath: string;
  sql: string;
  hash: string;
}

const advisoryLockId = (schema: string): number =>
  createHash("sha256").update(schema).digest().readInt32BE(0);

const loadMigrationFiles = (migrationsPath: string): MigrationFile[] => {
  if (!fs.existsSync(migrationsPath)) {
    return [];
  }

  return fs
    .readdirSync(migrationsPath)
    .filter((f) => f.endsWith(".sql") && MIGRATION_FILE_RE.test(f))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
    .map((filename) => {
      const fullPath = path.join(migrationsPath, filename);
      const sql = fs.readFileSync(fullPath, "utf8");
      const hash = createHash("sha256").update(sql).digest("hex");
      return { filename, fullPath, sql, hash };
    });
};

const migrateOnePlugin = async (
  pool: Pool,
  { pluginName, migrationsPath }: RegisteredMigration,
  logger?: Logger,
): Promise<void> => {
  const schema = pluginSchemaName(pluginName);
  const files = loadMigrationFiles(migrationsPath);
  if (files.length === 0) {
    return;
  }

  const client = await pool.connect();
  try {
    // Serialize concurrent server instances migrating the same plugin schema.
    await client.query("SELECT pg_advisory_lock($1, $2)", [
      ADVISORY_LOCK_NAMESPACE,
      advisoryLockId(schema),
    ]);

    try {
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(schema)}`);
      await client.query(
        `CREATE TABLE IF NOT EXISTS ${quoteIdent(schema)}.__migrations (
           filename   text PRIMARY KEY,
           hash       text NOT NULL,
           applied_at timestamptz NOT NULL DEFAULT now()
         )`,
      );

      const { rows } = await client.query<{ filename: string; hash: string }>(
        `SELECT filename, hash FROM ${quoteIdent(schema)}.__migrations`,
      );
      const appliedHashes = new Map(rows.map((r) => [r.filename, r.hash]));

      for (const file of files) {
        const appliedHash = appliedHashes.get(file.filename);

        if (appliedHash !== undefined) {
          if (appliedHash !== file.hash) {
            logger?.warn(
              { pluginName, schema, filename: file.filename },
              `Plugin migration "${file.filename}" changed after being applied. ` +
                `Applied migrations must be immutable. Add a new migration instead.`,
            );
          }
          continue;
        }

        await client.query("BEGIN");
        try {
          await client.query(
            `SET LOCAL search_path TO ${pluginSearchPath(schema)}`,
          );
          await client.query(file.sql);
          await client.query(
            `INSERT INTO ${quoteIdent(schema)}.__migrations (filename, hash)
             VALUES ($1, $2)`,
            [file.filename, file.hash],
          );
          await client.query("COMMIT");
          logger?.info(
            { pluginName, schema, filename: file.filename },
            `Applied plugin migration ${schema}/${file.filename}`,
          );
        } catch (err) {
          await client.query("ROLLBACK");
          logger?.error(
            { err, pluginName, schema, filename: file.filename },
            `Failed plugin migration ${schema}/${file.filename}`,
          );
          throw err;
        }
      }
    } finally {
      await client.query("SELECT pg_advisory_unlock($1, $2)", [
        ADVISORY_LOCK_NAMESPACE,
        advisoryLockId(schema),
      ]);
    }
  } finally {
    client.release();
  }
};

export const runPluginMigrations = async (
  pool: Pool,
  migrations: RegisteredMigration[],
  logger?: Logger,
): Promise<void> => {
  const failures: { pluginName: string; err: unknown }[] = [];

  for (const migration of migrations) {
    try {
      await migrateOnePlugin(pool, migration, logger);
    } catch (err) {
      failures.push({ pluginName: migration.pluginName, err });
    }
  }

  if (failures.length > 0) {
    const names = failures.map((f) => f.pluginName).join(", ");
    const aggregate = new Error(
      `Plugin migrations failed for: ${names}`,
    ) as Error & { failures: typeof failures };
    aggregate.failures = failures;
    throw aggregate;
  }
};
