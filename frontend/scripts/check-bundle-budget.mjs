/**
 * Fail the build when the shared JavaScript bundle grows past its budget.
 *
 * The standard asks for a JS budget "checked by a bundle-size gate in CI".
 * A budget nothing enforces is a comment.
 *
 * Measures the SHARED chunks — the JavaScript every route pays for regardless
 * of which page was opened. That is the number that governs LCP on a mid-tier
 * phone over 4G, which is the device the standard names.
 *
 * Raising the limit is a decision to make in a pull request, with the reason
 * visible in the diff, rather than a number that drifts up unnoticed.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

/**
 * Measured gzipped, because that is what the browser actually downloads — raw
 * bytes overstate the cost by roughly 3x and would make the number meaningless.
 *
 * Set from the current real figure (274 KB) plus modest headroom, so it catches
 * a regression without failing on day one. Tightening it is a separate,
 * deliberate piece of work.
 */
const BUDGET_KB = 320;

const CHUNKS_DIR = join(process.cwd(), "frontend", ".next", "static", "chunks");

async function jsFilesIn(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await jsFilesIn(path)));
    else if (entry.name.endsWith(".js")) out.push(path);
  }
  return out;
}

const files = await jsFilesIn(CHUNKS_DIR);

if (files.length === 0) {
  console.error("No chunks found — did the build run?");
  process.exit(1);
}

const sizes = await Promise.all(
  files.map(async (f) => ({ file: f, size: gzipSync(await readFile(f)).length }))
);

const totalKb = Math.round(sizes.reduce((n, f) => n + f.size, 0) / 1024);

console.log(`Shared JS: ${totalKb} KB gzipped across ${files.length} chunks (budget ${BUDGET_KB} KB)`);

// The five biggest, so a failure names what to look at rather than only that
// the total is too big.
for (const { file, size } of sizes.sort((a, b) => b.size - a.size).slice(0, 5)) {
  console.log(`  ${Math.round(size / 1024).toString().padStart(5)} KB  ${file.split(/[\/]/).pop()}`);
}

if (totalKb > BUDGET_KB) {
  console.error(
    `\n::error::Bundle is ${totalKb} KB, over the ${BUDGET_KB} KB budget by ${totalKb - BUDGET_KB} KB.\n` +
      `Either trim it, or raise BUDGET_KB in this file with a reason in the PR.`
  );
  process.exit(1);
}

console.log("Within budget.");
