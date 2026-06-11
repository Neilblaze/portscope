# Contributing to PortScope

Thank you for your interest in contributing to **PortScope**! We welcome contributions from everyone, whether you are fixing bugs, adding support for new frameworks, improving documentation, or optimizing our AI integrations.

This document outlines the process for contributing to the project to ensure a smooth and collaborative environment.

---

## 📚 Important Documentation

Before you begin, please make sure you familiarize yourself with our project's core guidelines:

1. **[AI Usage Policy](AI_USAGE_POLICY.md):** PortScope actively interfaces with LLMs. If you are using AI assistants or LLMs to help write your code contributions, you **must** review our AI Usage Policy to ensure your PR complies with our security and licensing standards.
2. **[CI/CD Pipelines](CI-CD.md):** Review our Continuous Integration and Deployment documentation to understand how our tests run and how releases are validated via GitHub Actions.

---

## 🛠️ Development Setup

PortScope is built with Node.js and uses zero external dependencies for its core test suite.

1. **Fork and Clone the Repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/portscope.git
   cd portscope
   ```
2. **Install Dependencies**
   ```bash
   npm install
   ```
3. **Run tests**
   Before starting your development, ensure all tests pass:
   ```bash
   npm test
   ```
4. **Run Locally in Development**
   ```bash
   npm run dev
   ```

---

## 📝 Pull Request Process

1. Create a new branch for your feature or bugfix (`git checkout -b feature/your-feature-name`).
2. Adhere to our coding conventions (keep things fast, lightweight, and native to OS utilities where possible).
3. Ensure you have added or updated tests covering your changes in the `tests/` directory.
4. Run `npm test` to confirm everything passes locally.
5. Push your branch and open a Pull Request (PR) against the `main` branch.
6. Wait for the CI checks to complete and for maintainers to review your code.

---

## 🚀 Creating a New Release

> **Note:** This section is primarily for project repository maintainers.

Releases to the GitHub Package Registry / npm are entirely automated via GitHub Actions when pushing a git tag.

To release a new version (e.g., `v1.2.0`), update the version organically in your `package.json` and follow these standard commands to update and trigger the workflow. If an existing tag's workflow fails and you need to deploy a fix under the same semantic version, use the following sequence to delete and recreate the tag:

```bash
# 1. Delete the existing tag locally
git tag -d v1.1.0

# 2. Delete the remote tag on GitHub
git push --delete origin v1.1.0

# 3. Recreate the tag against your latest commit
git tag v1.1.0

# 4. Push the new tag to trigger the release workflow
git push --tags
```

*(Ensure you replace `v1.1.0` with the actual target version you are deploying).*

OR, simply execute this in root directory (for reference):

```sh
./.release/release.sh --<version-number>
```
