import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "fs";
import { rm, writeFile } from "fs/promises";
import { join, resolve } from "path";
import type { Client } from "pg";

import { ExtensionManager } from "./extensions/index.js";
import { MigrationManager } from "./migration/index.js";
import type {
  ConnectionInfo,
  DatabaseUrls,
  EmbeddedPostgresConfig,
} from "./types/index.js";
import { getAppDataPaths } from "./utils/paths.js";

export class EmbeddedPostgresManager {
  private pg: any | null = null;
  private config: Required<EmbeddedPostgresConfig>;
  private extensionManager: ExtensionManager;
  private migrationManager: MigrationManager | null = null;
  private _isInitialized = false;
  private _isRunning = false;

  constructor(config: EmbeddedPostgresConfig = {}) {
    // Set default configuration
    this.config = {
      databaseDir: "",
      port: config.port || 7949,
      appDataFolderName: config.appDataFolderName || "TheOpenPresenter",
      databaseName: config.databaseName || "theopenpresenter",
      projectRoot: config.projectRoot || process.cwd(),
      persistent: config.persistent ?? true,
      roles: config.roles || {
        owner: {
          name: "theopenpresenter",
          password: "password_owner",
        },
        authenticator: {
          name: "theopenpresenter_authenticator",
          password: "password_authenticator",
        },
        visitor: {
          name: "theopenpresenter_visitor",
        },
      },
      migration: {
        gmrcPath: resolve(__dirname, "../../../backend/db/.gmrc.js"),
        ...config.migration,
      },
    };

    // Set up databaseDir
    const paths = getAppDataPaths(this.config.appDataFolderName);
    this.config.databaseDir = config.databaseDir || paths.databaseDir;

    // Initialize extension manager
    this.extensionManager = new ExtensionManager(this.config.projectRoot);

    // Set up signal handlers for graceful shutdown
    this.setupSignalHandlers();
  }

  async initialize(): Promise<void> {
    if (this._isInitialized) {
      console.log("Database already initialized");
      return;
    }

    console.log("Initializing embedded PostgreSQL...");

    // Create EmbeddedPostgres instance
    this.createPgInstance();

    // Install extensions first (before starting PostgreSQL)
    await this.extensionManager.installExtensions();

    // initdb creates the data dir as its first step, so the dir merely existing
    // does NOT mean setup finished (roles + first migration come later). We only
    // treat init as complete once a marker is written at the end of
    // performInitialSetup(). If the dir exists but the marker is missing, this is
    // either (a) a cluster created before the marker existed, or (b) a run that
    // was interrupted mid-setup. We must not blindly wipe - (a) holds real user
    // data — so we boot it and check whether the required roles exist:
    //   - roles present  -> healthy, just backfill the marker
    //   - roles missing  -> incomplete init, safe to wipe and redo
    if (
      existsSync(this.config.databaseDir) &&
      !existsSync(this.getInitMarkerPath())
    ) {
      const healthy = await this.verifyClusterHealthy();
      if (healthy) {
        console.log(
          "Existing database predates the init marker; backfilling marker.",
        );
        await this.writeInitMarker();
      } else {
        console.warn(
          "Detected an incomplete PostgreSQL initialization (required roles missing); removing the partial data dir and reinitializing...",
        );
        await rm(this.config.databaseDir, { recursive: true, force: true });
        // Recreate the instance so it cleanly re-runs initdb on the empty dir.
        this.createPgInstance();
      }
    }

    const needsInitialization = !existsSync(this.config.databaseDir);

    if (needsInitialization) {
      console.log("Database not found, performing initial setup...");
      await this.performInitialSetup();
      await this.writeInitMarker();
    }

    this._isInitialized = true;
    console.log("Database initialization completed");
  }

  private createPgInstance(): void {
    this.pg = new EmbeddedPostgres({
      databaseDir: this.config.databaseDir,
      user: "postgres",
      password: "password",
      port: this.config.port,
      persistent: this.config.persistent,
    });
  }

  private getInitMarkerPath(): string {
    return join(this.config.databaseDir, ".top-init-complete");
  }

  private async writeInitMarker(): Promise<void> {
    await writeFile(this.getInitMarkerPath(), `${new Date().toISOString()}\n`);
  }

  private async verifyClusterHealthy(): Promise<boolean> {
    if (!this.pg) {
      return false;
    }

    const startedHere = !this._isRunning;
    let client: Client | null = null;
    try {
      if (startedHere) {
        await this.pg.start();
        this._isRunning = true;
      }

      client = this.pg.getPgClient();
      if (!client) {
        return false;
      }
      await client.connect();

      const requiredRoles = [
        this.config.roles.owner.name,
        this.config.roles.authenticator.name,
        this.config.roles.visitor.name,
      ];
      const { rows } = await client.query(
        "SELECT rolname FROM pg_roles WHERE rolname = ANY($1)",
        [requiredRoles],
      );
      return rows.length === requiredRoles.length;
    } catch (err) {
      console.warn("Cluster health check failed:", err);
      return false;
    } finally {
      if (client) {
        try {
          await client.end();
        } catch {
          // ignore
        }
      }
      if (startedHere && this._isRunning) {
        await this.pg.stop();
        this._isRunning = false;
      }
    }
  }

  async start(): Promise<void> {
    if (!this.pg) {
      throw new Error("Database not initialized. Call initialize() first.");
    }

    if (this._isRunning) {
      console.log("Database already running");
      return;
    }

    console.log("Starting PostgreSQL...");
    await this.pg.start();
    this._isRunning = true;
    console.log(`PostgreSQL started on port ${this.config.port}`);

    // Set up migration manager after starting
    if (this.config.migration.gmrcPath) {
      this.migrationManager = new MigrationManager(
        this.config.migration,
        this.config.projectRoot,
        this.getDatabaseUrls(),
        this.config.roles.authenticator.name,
        this.config.roles.visitor.name,
      );
      console.log("Running migrations...")
      await this.migrationManager.runMigrations();

      // Safety net
      await this.ensureWorkerSchema();
    }
  }

  // Ensures the graphile-worker schema exists
  private async ensureWorkerSchema(): Promise<void> {
    if (!this.migrationManager || !this.pg) {
      return;
    }

    const client: Client = this.pg.getPgClient(this.config.databaseName);

    let exists = false;
    try {
      await client.connect();
      const { rows } = await client.query(
        "SELECT 1 FROM pg_namespace WHERE nspname = $1",
        ["graphile_worker"],
      );
      exists = rows.length > 0;
    } catch (err) {
      console.warn("Failed to check for graphile-worker schema:", err);
      return;
    } finally {
      try {
        await client.end();
      } catch {
        // ignore
      }
    }

    if (!exists) {
      console.warn("graphile-worker schema is missing; installing it now...");
      await this.migrationManager.installWorkerSchema();
    }
  }

  async stop(): Promise<void> {
    if (!this.pg || !this._isRunning) {
      console.log("Database not running");
      return;
    }

    console.log("Stopping PostgreSQL...");
    await this.pg.stop();
    this._isRunning = false;
    console.log("PostgreSQL stopped");
  }

  async runMigrations(): Promise<void> {
    if (!this.migrationManager) {
      throw new Error(
        "Migration manager not available. Ensure gmrcPath is configured and database is started.",
      );
    }

    await this.migrationManager.runMigrations();
  }

  async resetDatabase(): Promise<void> {
    if (!this.migrationManager) {
      throw new Error(
        "Migration manager not available. Ensure gmrcPath is configured and database is started.",
      );
    }

    await this.migrationManager.resetDatabase();
  }

  async watchMigrations(): Promise<void> {
    if (!this.migrationManager) {
      throw new Error(
        "Migration manager not available. Ensure gmrcPath is configured and database is started.",
      );
    }

    await this.migrationManager.watchMigrations();
  }

  getConnectionInfo(): ConnectionInfo {
    return {
      host: "localhost",
      port: this.config.port,
      database: this.config.databaseName,
      user: this.config.roles.owner.name,
      password: this.config.roles.owner.password,
    };
  }

  getConnectionString(): string {
    const conn = this.getConnectionInfo();
    return `postgres://${conn.user}:${conn.password}@${conn.host}:${conn.port}/${conn.database}`;
  }

  getDatabaseUrls(): DatabaseUrls {
    const ownerUrl = this.getConnectionString();
    const rootUrl = `postgres://postgres:password@localhost:${this.config.port}/postgres`;

    return {
      databaseUrl: ownerUrl,
      rootDatabaseUrl: rootUrl,
    };
  }

  isRunning(): boolean {
    return this._isRunning;
  }

  isInitialized(): boolean {
    return this._isInitialized;
  }

  private async performInitialSetup(): Promise<void> {
    if (!this.pg) {
      throw new Error("PostgreSQL instance not created");
    }

    let client: Client | null = null;

    try {
      // Initialize and start PostgreSQL
      await this.pg.initialise();
      await this.pg.start();
      this._isRunning = true;
      console.log("Database initialized & started. Running setup...");

      // Setup database roles
      client = this.pg.getPgClient();
      if (!client) {
        throw new Error("Failed to get PostgreSQL client");
      }

      await client.connect();
      await this.createDatabaseRoles(client);

      // Run initial migration if configured
      if (this.config.migration.gmrcPath) {
        const migrationManager = new MigrationManager(
          this.config.migration,
          this.config.projectRoot,
          this.getDatabaseUrls(),
          this.config.roles.authenticator.name,
          this.config.roles.visitor.name,
        );

        console.log("Running initial database reset...");
        await migrationManager.resetDatabase();
      }

      console.log("Initial database setup completed");
    } catch (error) {
      console.error("Failed to initialize PostgreSQL database:", error);
      throw error;
    } finally {
      if (client) {
        await client.end();
      }
    }
  }

  private async createDatabaseRoles(client: Client): Promise<void> {
    const { owner, authenticator, visitor } = this.config.roles;

    console.log("Creating database roles...");

    // Create owner role
    await client.query(
      `CREATE ROLE ${owner.name} WITH LOGIN PASSWORD '${owner.password}' SUPERUSER;`,
    );

    // Create authenticator role
    await client.query(
      `CREATE ROLE ${authenticator.name} WITH LOGIN PASSWORD '${authenticator.password}' NOINHERIT;`,
    );

    // Create visitor role
    await client.query(`CREATE ROLE ${visitor.name};`);

    // Grant visitor role to authenticator
    await client.query(`GRANT ${visitor.name} TO ${authenticator.name};`);

    console.log("Database roles created successfully");
  }

  private setupSignalHandlers(): void {
    const gracefulShutdown = async () => {
      console.log("Received shutdown signal, stopping PostgreSQL...");
      await this.stop();
      process.exit(0);
    };

    process.once("SIGINT", gracefulShutdown);
    process.once("SIGTERM", gracefulShutdown);
    process.once("SIGQUIT", gracefulShutdown);
  }
}
