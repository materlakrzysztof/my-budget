# @10x/code-reviewer

AI-powered code review foundation built on the [Vercel AI SDK](https://ai-sdk.dev)
(`ai` v7) with the [OpenRouter](https://openrouter.ai) provider and Zod-validated
structured output. Standalone ESM + TypeScript package that runs on Node.js 24's
native TypeScript support — no build step required to run.

## Setup

```bash
npm install
cp .env.example .env        # then set your OPENROUTER_API_KEY in .env
npm start
```

`.env` (git-ignored) holds your config:

```
OPENROUTER_API_KEY=sk-or-...                        # required
OPENROUTER_MODEL=anthropic/claude-sonnet-5          # optional (this is the default)
```

`npm start` and `npm run dev` load `.env` automatically via Node's native
`--env-file-if-exists` flag (no `dotenv` dependency). Running `node src/index.ts`
directly does **not** load `.env` unless you add the flag yourself, e.g.
`node --env-file-if-exists=.env src/index.ts`.

## Scripts

| Script              | What it does                                            |
| ------------------- | ------------------------------------------------------- |
| `npm start`         | Run `src/index.ts` directly on Node (native TS)         |
| `npm run dev`       | Same, with `--watch`                                    |
| `npm run typecheck` | `tsc --noEmit`                                           |
| `npm run build`     | Emit JS to `dist/` (`.ts` specifiers rewritten to `.js`) |

## Usage

```ts
import { reviewCode } from "@10x/code-reviewer";

const result = await reviewCode({
  code: "export function sum(ns) { let t; for (const n of ns) t += n; return t; }",
  filename: "sum.ts",
  language: "typescript",
});

console.log(result.summary);
for (const f of result.findings) {
  console.log(`[${f.severity}] ${f.title}${f.line ? ` (line ${f.line})` : ""}`);
}
```

`reviewCode` returns a value validated against `reviewResultSchema`
(`{ summary, findings[] }`). Both the schemas (`reviewResultSchema`,
`reviewFindingSchema`, `severitySchema`) and the model factory
(`createReviewModel`) are exported for building further integration on top.

## Stack

- `ai` (Vercel AI SDK v7) — `generateText` + `Output.object` for structured output
- `@openrouter/ai-sdk-provider` v3 — access to 300+ models via OpenRouter
- `zod` v4 — schema definition and validation
- TypeScript 7, `@types/node` 24, Node.js ≥ 24
