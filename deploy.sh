#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ec2-user/jagong-client}"
BRANCH="${DEPLOY_BRANCH:-master}"
BUILD_IMAGE="${BUILD_IMAGE:-node:22-bookworm-slim}"

cd "$APP_DIR"

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

if [ ! -f .env.production ]; then
  echo ".env.production is missing. Create it before building the production frontend."
  exit 1
fi

docker run --rm \
  -v "$APP_DIR":/app \
  -w /app \
  "$BUILD_IMAGE" \
  bash -lc "corepack enable && yarn install --frozen-lockfile && yarn build"
