/** Run schema.sql against the configured MySQL database. */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const config = require("../config");

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.name,
    multipleStatements: true,
  });
  try {
    await conn.query(sql);
    console.log("✓ Schema applied to", config.db.name);
  } finally {
    await conn.end();
  }
})().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
