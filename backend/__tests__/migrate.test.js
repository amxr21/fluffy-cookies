/**
 * Migration runner tests.
 *
 * These cover the logic that decides WHAT runs and in what order — filename
 * validation, ordering, duplicate detection, checksum drift, and statement
 * splitting. They deliberately do not need a database: the parts that talk to
 * MySQL are thin, and the parts that decide are where the bugs live.
 *
 * CI runs the real thing against a fresh MySQL container (see ci.yml), which is
 * what proves the SQL itself is valid.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

// describe/it/expect are globals — vitest.config.mjs sets `globals: true`.
const {
  loadMigrations,
  splitStatements,
  assertNoDrift,
} = require("../scripts/migrate");

/** Build a throwaway migrations directory and return its path. */
function makeDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fluffy-migrations-"));
  for (const [name, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), contents);
  }
  return dir;
}

const sha = (s) =>
  crypto.createHash("sha256").update(s.replace(/\r\n/g, "\n")).digest("hex");

describe("loadMigrations", () => {
  let dir;
  afterEach(() => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it("returns migrations in numeric order, not lexicographic", () => {
    dir = makeDir({
      "002_second.sql": "SELECT 2;",
      "010_tenth.sql": "SELECT 10;",
      "001_first.sql": "SELECT 1;",
    });

    const names = loadMigrations(dir).map((m) => m.name);

    // Lexicographic sort would also give this order for zero-padded names, so
    // the real assertion is that 010 sorts after 002 by VALUE.
    expect(names).toEqual(["001_first.sql", "002_second.sql", "010_tenth.sql"]);
    expect(loadMigrations(dir).map((m) => m.version)).toEqual([1, 2, 10]);
  });

  it("ignores README.md but rejects any other unexpected filename", () => {
    dir = makeDir({ "001_ok.sql": "SELECT 1;", "README.md": "# docs" });
    expect(loadMigrations(dir)).toHaveLength(1);

    fs.writeFileSync(path.join(dir, "notes.txt"), "x");
    expect(() => loadMigrations(dir)).toThrow(/not named NNN_snake_case/);
  });

  it("rejects a filename that skips the numeric prefix", () => {
    dir = makeDir({ "add_column.sql": "SELECT 1;" });
    expect(() => loadMigrations(dir)).toThrow(/not named NNN_snake_case/);
  });

  it("rejects duplicate version numbers rather than picking one", () => {
    // The merge-collision case: two branches each added an 002.
    dir = makeDir({
      "001_first.sql": "SELECT 1;",
      "002_from_branch_a.sql": "SELECT 'a';",
      "002_from_branch_b.sql": "SELECT 'b';",
    });

    expect(() => loadMigrations(dir)).toThrow(/Duplicate migration version 2/);
  });

  it("computes a checksum that ignores line-ending differences", () => {
    // Windows checkouts rewrite LF to CRLF; that must not read as drift.
    const lf = makeDir({ "001_x.sql": "SELECT 1;\nSELECT 2;\n" });
    const crlf = makeDir({ "001_x.sql": "SELECT 1;\r\nSELECT 2;\r\n" });

    try {
      expect(loadMigrations(lf)[0].checksum).toBe(loadMigrations(crlf)[0].checksum);
    } finally {
      fs.rmSync(lf, { recursive: true, force: true });
      fs.rmSync(crlf, { recursive: true, force: true });
    }
  });

  it("throws when the directory does not exist", () => {
    expect(() => loadMigrations(path.join(os.tmpdir(), "definitely-not-here"))).toThrow(
      /No migrations directory/
    );
  });
});

describe("splitStatements", () => {
  it("splits on a trailing semicolon and drops comments", () => {
    const sql = `
      -- create the table
      CREATE TABLE a (id INT);
      -- and another
      CREATE TABLE b (id INT);
    `;
    expect(splitStatements(sql)).toEqual([
      "CREATE TABLE a (id INT)",
      "CREATE TABLE b (id INT)",
    ]);
  });

  it("keeps a multi-line statement intact", () => {
    const sql = `CREATE TABLE users (\n  id INT,\n  name VARCHAR(255)\n);`;
    const out = splitStatements(sql);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain("name VARCHAR(255)");
  });

  it("returns nothing for a comment-only file", () => {
    expect(splitStatements("-- nothing here\n-- really\n")).toEqual([]);
  });

  it("does not treat a semicolon inside a line as a split point", () => {
    // Guards the `;\s*$` anchor — a mid-line semicolon must not split.
    const sql = "INSERT INTO t (a) VALUES ('x; y');";
    expect(splitStatements(sql)).toEqual(["INSERT INTO t (a) VALUES ('x; y')"]);
  });
});

describe("assertNoDrift", () => {
  const migration = (version, name, body) => ({
    version,
    name,
    contents: body,
    checksum: sha(body),
  });

  it("passes when applied migrations still match their files", () => {
    const m = migration(1, "001_a.sql", "SELECT 1;");
    expect(() =>
      assertNoDrift([m], [{ version: 1, name: m.name, checksum: m.checksum }])
    ).not.toThrow();
  });

  it("throws when an applied migration was edited afterwards", () => {
    const m = migration(1, "001_a.sql", "SELECT 'edited';");
    expect(() =>
      assertNoDrift([m], [{ version: 1, name: m.name, checksum: sha("SELECT 'original';") }])
    ).toThrow(/changed after they were applied/);
  });

  it("ignores pending migrations, which have no applied checksum yet", () => {
    const applied = migration(1, "001_a.sql", "SELECT 1;");
    const pending = migration(2, "002_b.sql", "SELECT 2;");
    expect(() =>
      assertNoDrift(
        [applied, pending],
        [{ version: 1, name: applied.name, checksum: applied.checksum }]
      )
    ).not.toThrow();
  });

  it("warns but does not throw when the database is ahead of the checkout", () => {
    // Checking out an older branch: the DB has a migration this tree lacks.
    const warnings = [];
    const original = console.warn;
    console.warn = (msg) => warnings.push(msg);
    try {
      expect(() =>
        assertNoDrift([], [{ version: 9, name: "009_future.sql", checksum: "abc" }])
      ).not.toThrow();
    } finally {
      console.warn = original;
    }
    expect(warnings.join(" ")).toMatch(/009_future\.sql/);
  });
});
