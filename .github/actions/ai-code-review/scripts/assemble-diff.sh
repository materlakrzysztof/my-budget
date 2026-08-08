#!/usr/bin/env bash
# Assemble the PR's title, body, and a byte-bounded diff for the scoring step.
#
# Title/body are written to files (never interpolated into a `run:` script
# via `${{ }}`) so untrusted PR text can't reach shell expansion.
#
# Env in:
#   GH_TOKEN, BASE_REF, PR_NUMBER, DIFF_MAX_BYTES, WORKDIR
# Outputs (GITHUB_OUTPUT):
#   truncated - "true" | "false"

set -euo pipefail

mkdir -p "$WORKDIR"

# fetch-depth: 0 on the calling workflow's checkout is required for this to
# resolve; the three-dot range excludes unrelated commits already on base.
git fetch origin "$BASE_REF" --depth=1 --quiet

gh pr view "$PR_NUMBER" --json title --jq '.title' >"$WORKDIR/pr-title.txt"
gh pr view "$PR_NUMBER" --json body --jq '.body // ""' >"$WORKDIR/pr-body.txt"

RAW_DIFF="$WORKDIR/diff.raw.txt"
git diff "origin/$BASE_REF...HEAD" >"$RAW_DIFF"

DIFF_FILE="$WORKDIR/diff.txt"
DIFF_BYTES=$(wc -c <"$RAW_DIFF")

if [ "$DIFF_BYTES" -gt "$DIFF_MAX_BYTES" ]; then
  head -c "$DIFF_MAX_BYTES" "$RAW_DIFF" >"$DIFF_FILE"
  printf '\n\n...[diff truncated at %s bytes]...\n' "$DIFF_MAX_BYTES" >>"$DIFF_FILE"
  echo "truncated=true" >>"$GITHUB_OUTPUT"
else
  cp "$RAW_DIFF" "$DIFF_FILE"
  echo "truncated=false" >>"$GITHUB_OUTPUT"
fi
