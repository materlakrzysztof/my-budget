#!/usr/bin/env bash
# Apply the mutually-exclusive PASS/FAIL label and always clear the
# `ai-cr:review` retry trigger so it is immediately re-addable.
#
# Env in:
#   GH_TOKEN, PR_NUMBER, VERDICT

set -euo pipefail

# Add/remove are split into separate calls: --remove-label 404s if the label
# isn't currently on the PR (e.g. first run), which would abort a combined
# add+remove call under `set -e`.
if [ "$VERDICT" = "PASS" ]; then
  gh pr edit "$PR_NUMBER" --add-label ai-cr:passed
  gh pr edit "$PR_NUMBER" --remove-label ai-cr:failed || true
else
  gh pr edit "$PR_NUMBER" --add-label ai-cr:failed
  gh pr edit "$PR_NUMBER" --remove-label ai-cr:passed || true
fi

# Always clear the retry trigger so it is immediately re-addable.
gh pr edit "$PR_NUMBER" --remove-label ai-cr:review || true
