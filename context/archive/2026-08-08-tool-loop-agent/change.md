---
id: tool-loop-agent
title: Modular code-review agent on ai-sdk ToolLoopAgent
status: archived
created: 2026-08-08
updated: 2026-08-09
archived_at: 2026-08-09T11:10:43Z
---

# Modular code-review agent on ai-sdk ToolLoopAgent

Refactor `packages/code-reviewer/src/index.ts` from a single-file `generateText`
reviewer into a modular, reusable code-review agent built on the AI SDK's
`ToolLoopAgent`. Extract structured-output schemas and prompts into their own
modules, expose a reusable agent factory plus a convenience wrapper so promptfoo
evals can drive it later. Eval environment itself is out of scope for this change.
