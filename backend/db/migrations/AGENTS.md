# Database Migrations Guide

## Creating Migrations

**IMPORTANT:** Always create migrations under `current/`, NOT directly in `committed/`.

`graphile-migrate` runs every `*.sql` file in `current/` in **alphabetical order** as a single transaction batch. For anything beyond a one-line tweak, split the change into multiple numbered files so each concern is reviewable on its own.

The migration workflow is:

1. Write your migration as one or more `NNN-name.sql` files in `current/`
2. Each file must be **idempotent** (can be run multiple times safely)
3. Use `yarn db commit` to roll the whole `current/` set into a new `committed/NNNNNN.sql`

## File Naming

Use a numeric prefix that sorts alphabetically and leaves room to insert later. The repo convention is **increments of 100**:

```
current/100-reset.sql
current/200-enums.sql
current/300-foo-columns.sql
current/400-helpers.sql
...
```

Why 100s instead of 1, 2, 3:

- Inserting a step between `200` and `300` is just `250-...` — no renumbering.
- Alphabetical sort agrees with numeric sort up to 999 files (we will never need more).
- Two-digit and three-digit prefixes mix correctly (`100-` < `200-` < `1000-`) only because every file has at least three digits; keep that invariant.

For a trivial single-file change you can still use `100-current.sql` — just don't fall back to the legacy `1-current.sql` name; it sorts before `100-` and breaks ordering once a second file is added.

## Splitting a Migration

When a change touches several layers (enums, tables, policies, functions), split by concern in dependency order. A typical layout for a feature migration:

| Prefix | Concern |
| ------ | ------- |
| `100-` | Reset / idempotent drops (run first so later `create`s don't conflict) |
| `200-` | Types / enums |
| `300-` | Schema (tables, columns, indexes, grants) |
| `400-` | Low-level helpers (`current_*` GUC readers, etc.) |
| `500-`+ | Higher-level tables that depend on the above |
| `800-` | RLS policies that reference the columns above |
| `900-`+ | SECURITY DEFINER functions / mutations |

The `100-reset.sql` file should drop **everything the rest of the migration creates**, in reverse-dependency order (functions → policies → tables → columns → types). That way the whole batch behaves like a single idempotent unit even though it spans many files.

## Migration Format

Write plain SQL. No special directives needed. Each file should be independently re-runnable; if a file is split out for clarity but only makes sense after `100-reset.sql` has run, document that at the top.

```sql
-- 300-foo-columns.sql
-- (drops live in 100-reset.sql)

alter table app_public.some_table
  add column new_column text;

grant insert(new_column) on app_public.some_table to :DATABASE_VISITOR;
```

## Idempotency

Migrations should be idempotent - they can be run multiple times without errors. Use patterns like:

- `drop column if exists` before `add column`
- `drop function if exists ... cascade` before `create function`
- `drop table if exists ... cascade` before `create table`
- `drop policy if exists` before `create policy`
- `drop type if exists ... cascade` before `create type`

When dropping, remember: **any RLS policy that references a column being dropped must be dropped first**, or PostgreSQL raises `2BP01`. The `100-reset.sql` ordering (functions → policies → tables → columns → types) avoids this.

## Gotchas

- `gm watch --once` reports `current.sql unchanged, skipping migration` when the hash matches the DB-cached hash. The message is misleading — the migration **is** applied. Verify by querying the DB, not by trusting the log line.
- After committing, `current/` is wiped and the contents land in `committed/NNNNNN.sql` as a single file. Don't worry about the per-file split being lost in `committed/` — that's expected; the split only exists for review-time clarity in `current/`.

## Examples

See `committed/000019.sql` for table creation with indexes, RLS policies, and grants.
