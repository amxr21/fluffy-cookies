# Migrations

Every schema change is a numbered file in this directory, committed and reviewed.
The database is never hand-edited.

## Writing one

Create `NNN_short_description.sql` with the next free number:

```
002_add_slug_to_products.sql
003_money_as_minor_units.sql
```

Rules:

- **Numbers are unique and never reused.** Two branches that both add `002` will
  collide on merge — that collision is deliberate, it forces you to decide the
  real order rather than silently applying two migrations as one.
- **Never edit an applied file.** The runner stores a checksum of every migration
  it applies and refuses to run if one changes underneath it. To fix a mistake,
  write a new migration.
- **One concern per file.** A file that adds a column and backfills it is fine; a
  file that also renames an unrelated table is not.
- **No `IF NOT EXISTS` in new migrations.** It hides the difference between "this
  ran" and "this silently did nothing". `001` keeps it only because it predates
  this runner and may meet databases where it already ran.
- Statements are split on `;` at end of line — see the caveat in `migrate.js`
  before writing a trigger or stored procedure.

## Running

```bash
pnpm migrate           # apply everything pending
pnpm migrate:status    # show applied vs pending, without changing anything
```

Each migration runs inside its own transaction and is recorded in
`schema_migrations` on success. A failure rolls that migration back and stops the
run — earlier migrations stay applied, so fix the file and run again.

> **Caveat:** MySQL implicitly commits on DDL (`CREATE TABLE`, `ALTER TABLE`), so
> the transaction cannot roll back a half-finished DDL migration. It still
> protects the `schema_migrations` bookkeeping and any DML. Keep each migration
> small enough that a partial failure is easy to reason about.

## CI

CI runs every migration against a fresh MySQL container on each PR, so a
migration that only works against your local database fails before it merges.
