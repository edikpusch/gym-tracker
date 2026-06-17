#!/bin/bash
set -e

npm install --legacy-peer-deps

if [ -n "$GITHUB_PERSONAL_ACCESS_TOKEN" ]; then
  REPO_URL="https://${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/edikpusch/gym-tracker.git"
  git push "$REPO_URL" HEAD:main
else
  echo "GITHUB_PERSONAL_ACCESS_TOKEN not set — skipping GitHub sync"
fi
