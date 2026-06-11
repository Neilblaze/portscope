#!/usr/bin/env bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_step() {
  echo -e "\n${BLUE}==> $1${NC}"
}

log_info() {
  echo -e "    $1"
}

log_warn() {
  echo -e "    ${YELLOW}$1${NC}"
}

log_error() {
  echo -e "${RED}Error: $1${NC}"
}

TARGET_VERSION=""
for arg in "$@"; do
  if [[ "$arg" =~ ^--v?([0-9]+\.[0-9]+\.[0-9]+.*)$ ]]; then
    TARGET_VERSION="${BASH_REMATCH[1]}"
  fi
done

if [ -z "$TARGET_VERSION" ]; then
  log_error "Missing target version flag."
  echo "Usage: $0 --<version>"
  exit 1
fi

TARGET_TAG="v$TARGET_VERSION"

# Ensure Node.js is available for package.json inspection
if ! command -v node &> /dev/null; then
  log_error "Node.js is required to read package.json"
  exit 1
fi

CURRENT_VERSION=$(node -p "require('./package.json').version")

log_step "Version Verification"
log_info "Current version: $CURRENT_VERSION"
log_info "Target version:  $TARGET_VERSION"

# Bump version if necessary
if [ "$CURRENT_VERSION" != "$TARGET_VERSION" ]; then
  log_step "Bumping Version"
  log_info "Updating package.json to $TARGET_VERSION..."
  npm version "$TARGET_VERSION" --no-git-tag-version
  
  git add package.json package-lock.json
  
  if [ -f "website/package.json" ]; then
    log_info "Updating website/package.json..."
    (cd website && npm version "$TARGET_VERSION" --no-git-tag-version)
    git add website/package.json website/package-lock.json || true
  fi

  log_info "Committing version bump..."
  git commit -m "chore: bump version to $TARGET_TAG"
  
  log_info "Pushing commit to remote..."
  git push origin HEAD
else
  log_step "Bumping Version"
  log_warn "package.json is already at $TARGET_VERSION. Skipping bump."
fi

# Recreate and push tags
log_step "Releasing Tag: $TARGET_TAG"

log_info "Removing existing local tag (if any)..."
git tag -d "$TARGET_TAG" 2>/dev/null || log_info "No local tag found."

log_info "Removing existing remote tag (if any)..."
git push --delete origin "$TARGET_TAG" 2>/dev/null || log_info "No remote tag found."

log_info "Creating new tag against latest commit..."
git tag "$TARGET_TAG"

log_info "Pushing tag to trigger release workflow..."
git push --tags

echo -e "\n${GREEN}Release $TARGET_TAG completed successfully.${NC}"
