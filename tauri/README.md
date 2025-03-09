# Tauri

This folder is responsible for TheOpenPresenter's Desktop build.

## Build details

The build process for this is quite complicated.
Essentially, when TOP is opened, we will:
1. Run PostgreSQL
   1. Initialize if needed (init db, create roles, run migrate reset)
2. Run DB migration
3. Start Node server
4. Open window pointing to the node server

### PostgreSQL

#### Running PG

To run postgres, we use the `embedded-postgres` npm package. 

> Note: We have an extra step during installation to copy our PG extension.

The logic for this is inside the `run_pg.mjs` file which is responsible for all DB related stuff.
This includes creating roles and running the migration.

#### Migration

Gmrc, worker

### Resource

Symlink