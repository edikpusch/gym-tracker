#!/bin/bash
set -e

npm install --legacy-peer-deps

# Install the post-commit git hook so every subsequent commit auto-pushes to GitHub.
HOOK_SRC="scripts/git-hooks/post-commit"
HOOK_DST=".git/hooks/post-commit"
if [ -f "$HOOK_SRC" ]; then
  cp "$HOOK_SRC" "$HOOK_DST"
  chmod +x "$HOOK_DST"
  echo "GitHub sync: post-commit hook installed."
fi
