export interface DatabaseRoles {
  owner: {
    name: string;
    password: string;
  };
  authenticator: {
    name: string;
    password: string;
  };
  visitor: {
    name: string;
  };
}

export interface MigrationConfig {
  gmrcPath?: string;
  nodeBinaryPath?: string;
}

export interface EmbeddedPostgresConfig {
  databaseDir?: string;
  port?: number;
  appDataFolderName?: string;
  databaseName?: string;
  projectRoot?: string;
  roles?: DatabaseRoles;
  migration?: MigrationConfig;
  persistent?: boolean;
}

export interface ConnectionInfo {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface DatabaseUrls {
  databaseUrl: string;
  rootDatabaseUrl: string;
}

export interface CommandOptions {
  cwd?: string;
  env?: Record<string, string>;
}
