#!/usr/bin/env bash
# Changes image.tag in costpilot-gitops/envs/<env>/values.yaml.
# Used by GitHub Actions and Jenkins. Only the "tag:" line inside the top-level
# "image:" block is touched, and the tag is validated first.
#
#   ./scripts/set-image-tag.sh sha-1a2b3c4 dev
#   ./scripts/set-image-tag.sh 20261125-101500-1a2b3c4 prod costpilot-gitops/envs/prod/values.yaml
set -euo pipefail

TAG="${1:-}"
ENV_NAME="${2:-dev}"
FILE="${3:-costpilot-gitops/envs/${ENV_NAME}/values.yaml}"

if [ -z "$TAG" ]; then
  echo "usage: $0 <tag> [dev|staging|prod] [values-file]" >&2
  exit 2
fi

# Docker tag rules: up to 128 characters, letters, digits, dot, underscore, dash.
if ! printf '%s' "$TAG" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'; then
  echo "Tag '$TAG' is not a valid Docker tag. Use letters, digits, dot, underscore or dash." >&2
  exit 2
fi

if [ ! -f "$FILE" ]; then
  echo "Values file not found: $FILE" >&2
  exit 2
fi

BEFORE=$(grep -n -m1 -E '^[[:space:]]+tag:' "$FILE" || true)
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

awk -v tag="$TAG" '
  /^image:[[:space:]]*$/ { inblock = 1; print; next }
  inblock && /^[^[:space:]]/ { inblock = 0 }
  inblock && !done && /^[[:space:]]*tag:/ {
    indent = $0; sub(/[^[:space:]].*$/, "", indent)
    comment = ""
    if (match($0, /#.*$/)) comment = " " substr($0, RSTART)
    print indent "tag: " tag comment
    done = 1
    next
  }
  { print }
  END { if (!done) exit 3 }
' "$FILE" > "$TMP" || { echo "No 'tag:' line inside the image: block in $FILE" >&2; exit 3; }

cat "$TMP" > "$FILE"
echo "Updated $FILE"
echo "  before: $BEFORE"
echo "  after:  $(grep -n -m1 -E '^[[:space:]]+tag:' "$FILE" || true)"
