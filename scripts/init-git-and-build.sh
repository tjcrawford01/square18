#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Force Git to use this directory (avoids "not a git repository" in some environments)
export GIT_DIR="$ROOT/.git"
export GIT_WORK_TREE="$ROOT"

echo "Initializing Git..."
git init

echo "Setting Git user (global so commit succeeds)..."
git config --global user.name "TJ Crawford"
git config --global user.email "tjcrawford01@gmail.com"

echo "Creating initial commit..."
# Exclude .env so Git never tries to read it (avoids 'short read' and keeps secrets out)
git add --all -- ':!.env' ':!.env.*' ':!.env.local'
git commit -m "Initial commit" || true

echo "Running EAS build..."
npm run build:ios
