# Database Migrations Guide

## Creating Migrations

**IMPORTANT:** Always create migrations in `current/1-current.sql`, NOT directly in `committed/`.

The migration workflow is:

1. Write your migration in `current/1-current.sql`
2. The migration must be **idempotent** (can be run multiple times safely)
3. Use `yarn db commit` to commit the migration to `committed/`

## Migration Format

Write plain SQL in `current/1-current.sql`. The file is just regular SQL - no special directives needed.

```sql
-- Reset for idempotency
alter table app_public.some_table
  drop column if exists new_column;

-- Add the new column
alter table app_public.some_table
  add column new_column text;

-- Grant permissions
grant insert(new_column) on app_public.some_table to :DATABASE_VISITOR;
```

## Idempotency

Migrations should be idempotent - they can be run multiple times without errors. Use patterns like:

- `drop column if exists` before `add column`
- `drop function if exists` before `create function`
- `drop table if exists` before `create table`

## Examples

See `committed/000019.sql` for examples of table creation with indexes, RLS policies, and grants.
