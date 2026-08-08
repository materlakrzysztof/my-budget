// Fixture test for the deterministic gate: any criterion below the floor
// must FAIL, all at/above must PASS. Run with `node --test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const gateScript = path.join(dir, "gate.mjs");

function runGate(fixtureName, floor) {
  const outputFile = path.join(mkdtempSync(path.join(tmpdir(), "ai-cr-gate-")), "output");
  writeFileSync(outputFile, "");
  execFileSync(process.execPath, [gateScript], {
    env: {
      ...process.env,
      REVIEW_FILE: path.join(dir, "__fixtures__", fixtureName),
      CRITERION_FLOOR: String(floor),
      GITHUB_OUTPUT: outputFile,
    },
  });
  const output = readFileSync(outputFile, "utf8");
  const verdict = /verdict=(\w+)/.exec(output)?.[1];
  return { output, verdict };
}

test("gate FAILs when any criterion is below the floor", () => {
  const { verdict, output } = runGate("review-below-floor.json", 5);
  assert.equal(verdict, "FAIL");
  assert.match(output, /failing-criteria=testRiskCoverage/);
});

test("gate PASSes when every criterion is at or above the floor", () => {
  const { verdict, output } = runGate("review-at-or-above-floor.json", 5);
  assert.equal(verdict, "PASS");
  assert.match(output, /failing-criteria=\n/);
});
