import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "fs";
import type { Client } from "pg";
import { getAppDataPaths } from "./utils/paths.js";
import { ExtensionManager } from "./extensions/index.js";
import { MigrationManager } from "./migration/index.js";
import type {
  EmbeddedPostgresConfig,
  DatabaseRoles,
  ConnectionInfo,
  DatabaseUrls,
} from "./types/index.js";

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
      migration: config.migration || {},
      extensions: config.extensions || { installPgUuidv7: true },
    };

    // Set up paths
    const paths = getAppDataPaths(this.config.appDataFolderName);
    this.config.databaseDir = config.databaseDir || paths.databaseDir;

    // Initialize extension manager
    this.extensionManager = new ExtensionManager(this.config.projectRoot, this.config.extensions);

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
    this.pg = new EmbeddedPostgres({
      databaseDir: this.config.databaseDir,
      user: "postgres",
      password: "password",
      port: this.config.port,
      persistent: this.config.persistent,
    });

    // Install extensions first (before starting PostgreSQL)
    await this.extensionManager.installExtensions();

    const needsInitialization = !existsSync(this.config.databaseDir);

    if (needsInitialization) {
      console.log("Database not found, performing initial setup...");
      await this.performInitialSetup();
    }

    this._isInitialized = true;
    console.log("Database initialization completed");
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
        this.config.roles.visitor.name
      );
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
      throw new Error("Migration manager not available. Ensure gmrcPath is configured and database is started.");
    }

    await this.migrationManager.runMigrations();
  }

  async resetDatabase(): Promise<void> {
    if (!this.migrationManager) {
      throw new Error("Migration manager not available. Ensure gmrcPath is configured and database is started.");
    }

    await this.migrationManager.resetDatabase();
  }

  async watchMigrations(): Promise<void> {
    if (!this.migrationManager) {
      throw new Error("Migration manager not available. Ensure gmrcPath is configured and database is started.");
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
          this.config.roles.visitor.name
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
      `CREATE ROLE ${owner.name} WITH LOGIN PASSWORD '${owner.password}' SUPERUSER;`
    );

    // Create authenticator role
    await client.query(
      `CREATE ROLE ${authenticator.name} WITH LOGIN PASSWORD '${authenticator.password}' NOINHERIT;`
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