# Continuous Integration & Delivery (CI/CD)

PortScope relies on automated GitHub Actions pipelines to ensure cross-platform stability, enforce code quality, and automate our publishing workflow. This document outlines the architecture and expectations of our CI/CD pipelines.

## 1. Pull Request Checks

To maintain the high reliability of PortScope across environments, every Pull Request must pass the automated matrix checks before it can be merged.

### The CI Matrix
Our test suite executes on a strict **3×3 matrix**:
- **Operating Systems**: Ubuntu (Linux), macOS, Windows
- **Node.js Versions**: 18.x, 20.x, 22.x

### What Gets Tested
During the PR workflow, the pipeline automatically validates:
1. **Module Integrity**: Verifies all dependencies map correctly and tree-shaking succeeds without missing imports.
2. **CLI Smoke Tests**: Executes the compiled binary locally to ensure standard commands (`list`, `ps`, `logs`) execute and exit cleanly on the target OS.
3. **Linting & Formatting**: Enforces standard style guidelines to ensure codebase consistency.

## 2. Automated Release & npm Publishing

PortScope uses a tag-based automated release strategy. Pushing a valid SemVer tag directly triggers our `release.yml` workflow, which handles the secure publishing to the npm registry.

### Releasing a New Version (Maintainers)

1. Ensure all your changes are merged and passing in the `main` branch.
2. Local sync and version bump (this automatically updates `package.json` and creates a git tag):
   ```bash
   git checkout main && git pull
   
   npm version patch  # For bug fixes (e.g., 1.0.1 -> 1.0.2)
   npm version minor  # For new features (e.g., 1.0.1 -> 1.1.0)
   npm version major  # For breaking changes (e.g., 1.1.0 -> 2.0.0)
   ```
3. Push the commit and the generated tags to GitHub:
   ```bash
   git push origin main --tags
   ```

### Publishing Workflow
Once the tag is pushed, the `release.yml` Action will:
1. Checkout the source code.
2. Provision the Node.js build environment.
3. Install dependencies with deterministic locks (`npm ci`).
4. Publish the verified package to npm using strict provenance.

> [!IMPORTANT]
> **Authentication Requirement:**
> For the release workflow to successfully authenticate with npm, the `NPM_TOKEN` must be configured in the GitHub repository. 
> Navigate to **Settings → Secrets and variables → Actions**, and add the token as a New Repository Secret.

## 3. Pre-Commit Validation

To save CI minutes and accelerate the review process, contributors are highly encouraged to run the following local CI-analog standards before pushing their commits:

```bash
npm run format      # Formats code using Prettier
npm run lint        # Verifies ESLint rules
npm run test        # Runs the local unit and smoke suites
```