import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const LINTABLE = /\.(ts|tsx|astro|js|jsx)$/;

let input = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) input += chunk;

let payload;
try {
  payload = JSON.parse(input);
} catch {
  process.exit(0);
}

const filePath = payload?.tool_input?.file_path;
if (!filePath || !LINTABLE.test(filePath)) {
  process.exit(0);
}

const cwd = payload.cwd ?? process.cwd();
// Invoke ESLint's own entrypoint via `node` directly instead of the `npx`/eslint
// shim: on Windows, spawning .cmd files without a shell throws EINVAL (Node's
// CVE-2024-27980 fix), and shell:true would concatenate filePath unescaped.
const eslintBin = path.join(cwd, "node_modules", "eslint", "bin", "eslint.js");
if (!existsSync(eslintBin)) {
  process.exit(0);
}

try {
  execFileSync(process.execPath, [eslintBin, "--fix", "--quiet", filePath], {
    stdio: "inherit",
    cwd,
  });
} catch {
  // eslint exits non-zero when unfixable errors remain — don't block the agent turn
}
process.exit(0);
