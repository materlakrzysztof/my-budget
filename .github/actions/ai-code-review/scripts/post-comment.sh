#!/usr/bin/env bash
# Post the review comment, or update the prior one in place (matched by the
# hidden <!-- ai-code-review --> marker) so re-runs never duplicate the
# comment thread.
#
# Env in:
#   GH_TOKEN, PR_NUMBER, COMMENT_FILE
# GITHUB_REPOSITORY is provided by the runner.

set -euo pipefail

MARKER="<!-- ai-code-review -->"

EXISTING_ID=$(gh api --paginate "repos/${GITHUB_REPOSITORY}/issues/${PR_NUMBER}/comments" \
  --jq "[.[] | select(.body | startswith(\"${MARKER}\"))] | first | .id // empty")

if [ -n "$EXISTING_ID" ]; then
  gh api --method PATCH "repos/${GITHUB_REPOSITORY}/issues/comments/${EXISTING_ID}" \
    -f body="$(cat "$COMMENT_FILE")" >/dev/null
else
  gh pr comment "$PR_NUMBER" --body-file "$COMMENT_FILE"
fi
