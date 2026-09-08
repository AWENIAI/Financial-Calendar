#!/usr/bin/env bash
set -euo pipefail

cd /opt/Financial-Calendar

if [ -n "$(git diff --name-only --diff-filter=U)" ]; then
  echo "Preflight error: unresolved Git conflicts" >&2
  exit 1
fi

git fetch origin main
git merge --ff-only origin/main

npm test
npm run update-cffex-position
npm run update-cffex-followup-review
npm run update-earnings
npm run update-released-earnings-analysis
npm run generate

/opt/Financial-Calendar/ops/calendar-git-sync.sh /opt/Financial-Calendar \
  "chore: auto-sync financial calendar update" \
  data/cffex-position-watch.json \
  data/us-megacap-earnings.json \
  public/calendar/GLOBAL_KEY.ics \
  README.md README.backup.md \
  package.json package-lock.json \
  scripts/risk-calendar/update-cffex-position-watch.mjs \
  scripts/risk-calendar/update-cffex-followup-review.mjs \
  scripts/risk-calendar/update-us-megacap-earnings.mjs \
  scripts/risk-calendar/update-released-earnings-analysis.mjs \
  scripts/risk-calendar/generate-risk-calendar.mjs \
  scripts/risk-calendar/cffex-market-impact.mjs \
  scripts/risk-calendar/cffex-position-history.mjs \
  run-update.sh \
  ops/calendar-git-sync.sh \
  ops/financial-calendar.service \
  .githooks/pre-commit
