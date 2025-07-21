import { runCommand } from "../utils/command.js";
import { getGraphilePaths } from "../utils/paths.js";
import type { MigrationConfig, DatabaseUrls } from "../types/index.js";

export class MigrationManager {
  private config: MigrationConfig;
  private projectRoot: string;
  private databaseUrls: DatabaseUrls;
  private databaseAuthenticator: string;
  private databaseVisitor: string;

  constructor(
    config: MigrationConfig,
    projectRoot: string,
    databaseUrls: DatabaseUrls,
    databaseAuthenticator: string,
    databaseVisitor: string
  ) {
    this.config = config;
    this.projectRoot = projectRoot;
    this.databaseUrls = databaseUrls;
    this.databaseAuthenticator = databaseAuthenticator;
    this.databaseVisitor = databaseVisitor;
  }

  async resetDatabase(): Promise<void> {
    const { nodeBinaryPath = "node", gmrcPath } = this.config;
    
    if (!gmrcPath) {
      throw new Error("gmrcPath is required for database reset");
    }

    const { graphileMigrateJsPath } = getGraphilePaths(this.projectRoot);

    console.log("Resetting database schema...");
    await runCommand(
      nodeBinaryPath,
      [graphileMigrateJsPath, "-c", gmrcPath, "reset", "--erase"],
      {
        env: {
          DATABASE_URL: this.databaseUrls.databaseUrl,
          ROOT_DATABASE_URL: this.databaseUrls.rootDatabaseUrl,
          DATABASE_AUTHENTICATOR: this.databaseAuthenticator,
          DATABASE_VISITOR: this.databaseVisitor,
        },
      }
    );
    console.log("Database schema reset completed");
  }

  async runMigrations(): Promise<void> {
    const { nodeBinaryPath = "node", gmrcPath } = this.config;
    
    if (!gmrcPath) {
      throw new Error("gmrcPath is required for migrations");
    }

    const { graphileMigrateJsPath } = getGraphilePaths(this.projectRoot);

    console.log("Running database migrations...");
    await runCommand(
      nodeBinaryPath,
      [graphileMigrateJsPath, "-c", gmrcPath, "migrate"],
      {
        env: {
          DATABASE_URL: this.databaseUrls.databaseUrl,
          ROOT_DATABASE_URL: this.databaseUrls.rootDatabaseUrl,
          DATABASE_AUTHENTICATOR: this.databaseAuthenticator,
          DATABASE_VISITOR: this.databaseVisitor,
        },
      }
    );
    console.log("Database migrations completed");
  }

  async watchMigrations(): Promise<void> {
    const { nodeBinaryPath = "node", gmrcPath } = this.config;
    
    if (!gmrcPath) {
      throw new Error("gmrcPath is required for migration watching");
    }

    const { graphileMigrateJsPath } = getGraphilePaths(this.projectRoot);

    console.log("Starting migration watcher...");
    await runCommand(
      nodeBinaryPath,
      [graphileMigrateJsPath, "-c", gmrcPath, "watch"],
      {
        env: {
          DATABASE_URL: this.databaseUrls.databaseUrl,
          ROOT_DATABASE_URL: this.databaseUrls.rootDatabaseUrl,
          DATABASE_AUTHENTICATOR: this.databaseAuthenticator,
          DATABASE_VISITOR: this.databaseVisitor,
        },
      }
    );
  }
}