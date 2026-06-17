#!/bin/bash
set -e

npm install --legacy-peer-deps

if [ -n "$GITHUB_PERSONAL_ACCESS_TOKEN" ]; then
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
  REPO_URL="https://${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/edikpusch/gym-tracker.git"
  echo "GitHub sync: pushing branch '${CURRENT_BRANCH}'..."
  if git push "$REPO_URL" "HEAD:${CURRENT_BRANCH}" --force-with-lease 2>&1; then
    echo "GitHub sync: push successful."
  else
    echo "GitHub sync: WARNING — push failed. Check GITHUB_PERSONAL_ACCESS_TOKEN and remote status."
  fi
else
  echo "GitHub sync: GITHUB_PERSONAL_ACCESS_TOKEN not set — skipping."
fi
