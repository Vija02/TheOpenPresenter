# @repo/embedded-postgres

A wrapper package for managing an embedded PostgreSQL instance with custom extensions and migrations. This package is designed to handle PostgreSQL setup and management for both Tauri applications and local development environments.

## Overview

This package provides:
- Embedded PostgreSQL instance management
- Custom PostgreSQL extension handling (including pg_uuidv7)
- Database migration management

## Current Usage

### In Tauri Applications

This package is used within Tauri applications to provide a local PostgreSQL database instance with custom extensions pre-configured.

### Local Development

For local development, you can use the embedded PostgreSQL instance through the local development script:

```bash
yarn local-dev
```

This command will:
1. Set up a development environment (creating `.env` from `.env.dev` if needed)
2. Build the embedded-postgres package if not already built
3. Start the PostgreSQL instance
4. Display connection information and URLs

The local development script is located at [`scripts/local-dev.mjs`](../../scripts/local-dev.mjs:1).
