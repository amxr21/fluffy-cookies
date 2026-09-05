/**
 * Migration runner.
 *
 * Applies every pending file in ../migrations in numeric order, one transaction
 * each, recording what ran in `schema_migrations`. Re-running is a no-op.
 *
 *   node scripts/migrate.js            apply pending migrations
 *   node scripts/migrate.js --status   report only, change nothing
 *
 * Replaces the previous single-schema.sql approach, which could only express
 * CREATE TABLE IF NOT EXISTS and had no way to represent an ALTER.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mysql = require("mysql2/promise");
const config = require("../config");

const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");
const FILE_RE = /^(\d+)_[a-z0-9_]+\.sql$/;

const checksum = (contents) =>
  crypto.createHash("sha256").update(contents.replace(/\r\n/g, "\n")).digest("hex");

/**
 * Read and validate the migration files on disk.
 *
 * Rejects duplicate version numbers rather than picking one — two branches that
 * both added `002` is a merge that needs a human decision, not a coin flip.
 */
function loadMigrations(dir = MIGRATIONS_DIR) {
  if (!fs.existsSync(dir)) {
    throw new Error(`No migrations directory at ${dir}`);
  }

  const seen = new Map();
  const migrations = [];

  for (const name of fs.readdirSync(dir).sort()) {
    if (name.endsWith(".md")) continue;
    const match = FILE_RE.exec(name);
    if (!match) {
      throw new Error(
        `Migration "${name}" is not named NNN_snake_case.sql — rename it or move it out of migrations/`
      );
    }

    const version = Number(match[1]);
    if (seen.has(version)) {
      throw new Error(
        `Duplicate migration version ${version}: "${seen.get(version)}" and "${name}". ` +
          `Renumber one of them so the order is explicit.`
      );
    }
    seen.set(version, name);

    const contents = fs.readFileSync(path.join(dir, name), "utf8");
    migrations.push({ version, name, contents, checksum: checksum(contents) });
  }

  return migrations.sort((a, b) => a.version - b.version);
}

/**
 * Split a migration file into individual statements.
 *
 * Deliberately simple: strips `--` comments, then splits on a semicolon at end
 * of line. That covers DDL and DML but NOT a trigger or stored procedure whose
 * body contains semicolons. Add DELIMITER handling here if a migration ever
 * needs one, rather than working around it in the SQL.
 */
function splitStatements(sql) {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(/;\s*$/m)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function ensureMigrationsTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     INT PRIMARY KEY,
      name        VARCHAR(255) NOT NULL,
      checksum    CHAR(64) NOT NULL,
      applied_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

/**
 * Fail if a migration already applied has since been edited. Silent drift
 * between what ran and what the repo says ran is how environments diverge
 * without anyone noticing.
 */
function assertNoDrift(migrations, applied) {
  const byVersion = new Map(applied.map((row) => [row.version, row]));
  const drifted = migrations
    .filter((m) => byVersion.has(m.version))
    .filter((m) => byVersion.get(m.version).checksum !== m.checksum);

  if (drifted.length) {
    const list = drifted.map((m) => `  - ${m.name}`).join("\n");
    throw new Error(
      `These migrations changed after they were applied:\n${list}\n\n` +
        `Applied migrations are immutable. Write a new migration with the fix instead.`
    );
  }

  // An applied version with no file is usually a checkout of an older branch.
  // Warn rather than fail: the database is ahead, which blocks nothing here.
  const onDisk = new Set(migrations.map((m) => m.version));
  for (const row of applied) {
    if (!onDisk.has(row.version)) {
      console.warn(
        `! ${row.name} (version ${row.version}) is recorded as applied but has no file on disk`
      );
    }
  }
}

async function connect() {
  return mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.name,
    ssl: config.db.ssl ? { rejectUnauthorized: config.db.sslRejectUnauthorized } : undefined,
    multipleStatements: false,
  });
}

async function run({ statusOnly }) {
  const migrations = loadMigrations();
  const conn = await connect();

  try {
    await ensureMigrationsTable(conn);
    const [applied] = await conn.query(
      "SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version"
    );

    assertNoDrift(migrations, applied);

    const appliedVersions = new Set(applied.map((row) => row.version));
    const pending = migrations.filter((m) => !appliedVersions.has(m.version));

    if (statusOnly) {
      console.log(`Database: ${config.db.name} @ ${config.db.host}:${config.db.port}\n`);
      for (const m of migrations) {
        const row = applied.find((a) => a.version === m.version);
        const when = row ? new Date(row.applied_at).toISOString().slice(0, 19).replace("T", " ") : "";
        console.log(`  ${row ? "✓ applied" : "· pending"}  ${m.name}${when ? `  ${when}` : ""}`);
      }
      console.log(
        `\n${applied.length} applied, ${pending.length} pending.`
      );
      return;
    }

    if (!pending.length) {
      console.log("✓ Database is up to date — no pending migrations.");
      return;
    }

    for (const migration of pending) {
      const statements = splitStatements(migration.contents);
      if (!statements.length) {
        console.warn(`! ${migration.name} contains no statements — recording it anyway`);
      }

      process.stdout.write(`→ ${migration.name} … `);
      await conn.beginTransaction();
      try {
        for (const statement of statements) {
          await conn.query(statement);
        }
        await conn.query(
          "INSERT INTO schema_migrations (version, name, checksum) VALUES (?, ?, ?)",
          [migration.version, migration.name, migration.checksum]
        );
        await conn.commit();
        console.log(`ok (${statements.length} statement${statements.length === 1 ? "" : "s"})`);
      } catch (err) {
        await conn.rollback();
        console.log("failed");
        // MySQL commits DDL implicitly, so a half-finished ALTER may survive the
        // rollback. Say so rather than implying the database is untouched.
        throw new Error(
          `${migration.name} failed: ${err.message}\n` +
            `  The schema_migrations row was rolled back, but MySQL commits DDL ` +
            `implicitly — inspect the database before re-running.`
        );
      }
    }

    console.log(`\n✓ Applied ${pending.length} migration${pending.length === 1 ? "" : "s"} to ${config.db.name}`);
  } finally {
    await conn.end();
  }
}

// Only run when invoked as a script — importing this module (tests) must not
// open a database connection.
if (require.main === module) {
  const statusOnly = process.argv.includes("--status");

  run({ statusOnly }).catch((err) => {
    console.error(`\nMigration ${statusOnly ? "status check" : "run"} failed:\n${err.message}`);
    process.exit(1);
  });
}

module.exports = { loadMigrations, splitStatements, assertNoDrift, checksum, run };
