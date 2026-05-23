# AGENTS Guidelines for This Repository

This repository contains **PortScope**, a CLI tool for port management and process
inspection. The repository has two main components:

1. **CLI Tool** (root) — Node.js ES module-based CLI application
2. **Website** (`website/`) — React + Vite + TypeScript marketing site

When working on this project with an AI agent, follow the guidelines below to maintain
code quality and avoid common pitfalls.

---

## 1. Project Structure

### CLI Tool (Root Directory)
- **Type**: Node.js CLI application (ES modules)
- **Entry Point**: `src/index.js`
- **Language**: JavaScript (ES modules)
- **Architecture**:
  - `src/commands/` - CLI command handlers
  - `src/scanner/` - Port, process, and environment detection logic
  - `src/ai/` - Multi-provider LLM orchestration, conversation loop, and AI tools
  - `src/ui/` - Custom markdown renderer (`markdown.js`), animations, and ghost-text
  - `src/config/` - Configuration and credential masking
- **Key Dependencies**: `chalk`, `cli-table3`, `string-width`
- **Node Version**: >=18

### Website (`website/`)
- **Type**: React + Vite + TypeScript SPA
- **Entry Point**: `website/src/main.tsx`
- **Language**: TypeScript + React
- **Key Dependencies**: React 19, Vite 8, TailwindCSS, Radix UI

---

## 2. Development Workflow

### CLI Tool Development

```bash
# Run the CLI locally
npm start                    # Interactive mode
npm run dev                  # Same as npm start
node src/index.js --help     # Direct execution

# Run tests
npm test                     # Node.js native test runner
```

**Important Notes:**
- The CLI uses ES modules (`"type": "module"` in `package.json`)
- All imports must use `.js` extensions
- The tool is designed to run quickly (~0.2s) — avoid adding heavy dependencies
- Test files are in `tests/` and use Node.js built-in test runner

### Website Development

```bash
cd website

# Development server with HMR
npm run dev                  # Starts Vite dev server

# Build for production
npm run build                # TypeScript compilation + Vite build

# Lint
npm run lint                 # ESLint checks

# Preview production build
npm run preview              # Serve production build locally
```

**Important Notes:**
- **Always use `npm run dev` for development** — provides HMR and fast refresh
- **Do NOT run `npm run build` during active development** — it compiles TypeScript and creates production assets, which disables HMR
- The website uses TypeScript strict mode — ensure type safety
- TailwindCSS is configured — use utility classes, avoid custom CSS when possible

---

## 3. Coding Conventions

### CLI Tool (Root)
- **Language**: JavaScript (ES modules)
- **Style**: Functional, minimal dependencies, fast execution.
- **Error Handling**: Use chalk for colored error messages. Always sanitize errors to prevent API key leakage.
- **Platform Support**: Cross-platform (macOS, Linux, Windows) with graceful fallbacks.
- **Commands**: Keep command handlers in `src/commands/`
- **Utilities**: Scanner logic in `src/scanner/`, UI in `src/ui/`, AI logic in `src/ai/`
- **UI & Output**: Always use the custom Markdown renderer (`src/ui/markdown.js`) for displaying data in the CLI. Output Markdown tables (`|...|...|`) for structured data instead of raw text blocks.
- **Permissions**: Handle `EPERM` cleanly using the Sudo Interceptor (`src/utils/sudo.js`) rather than crashing or explicitly requiring users to run the entire CLI as root.

### Website
- **Language**: TypeScript (`.tsx`/`.ts`)
- **Components**: Functional components with hooks
- **Styling**: TailwindCSS utility classes
- **UI Components**: Radix UI primitives in `src/components/ui/`
- **Theme**: Dark mode support via `next-themes`

---

## 4. Testing

### CLI Tool
```bash
npm test                          # Run all tests in tests/
node --test tests/format.test.js  # Run specific test
```

Tests use Node.js native test runner (`node:test`). Test files follow the pattern `tests/*.test.js`.

### Website
No test suite currently configured. If adding tests, use Vitest (already compatible with Vite).

---

## 5. Dependencies

### CLI Tool
- **Package Manager**: npm (uses `package-lock.json`)
- **Lockfiles**: `package-lock.json` (primary), `pnpm-lock.yaml` (legacy)
- When adding dependencies, run `npm install <package>` and commit the updated lockfile

### Website
- **Package Manager**: npm (uses `package-lock.json`)
- When adding dependencies, run `npm install <package>` from the `website/` directory

---

## 6. Common Pitfalls

### CLI Tool
- ❌ **Don't** add heavy dependencies — the CLI must stay fast
- ❌ **Don't** use CommonJS (`require`) — this is an ES module project
- ❌ **Don't** forget `.js` extensions in imports
- ❌ **Don't** output bland raw text for AI responses. Always leverage Markdown tables and blockquotes for high-fidelity CLI styling.
- ❌ **Don't** bypass the AI `SYSTEM_PROMPT` rules or the Sudo Interceptor for permission errors.
- ✅ **Do** test on multiple platforms (macOS, Linux, Windows)
- ✅ **Do** handle errors gracefully with user-friendly messages and sanitized logs.

### Website
- ❌ **Don't** run `npm run build` during development — it breaks HMR
- ❌ **Don't** add custom CSS files — use TailwindCSS utilities
- ❌ **Don't** ignore TypeScript errors — fix them before committing
- ✅ **Do** use `npm run dev` for development
- ✅ **Do** test dark mode compatibility
- ✅ **Do** ensure responsive design (mobile, tablet, desktop)

---

## 7. Useful Commands Recap

### CLI Tool (Root)
| Command            | Purpose                                            |
| ------------------ | -------------------------------------------------- |
| `npm start`        | Run CLI in interactive mode                        |
| `npm run dev`      | Same as `npm start`                                |
| `npm test`         | Run test suite                                     |
| `node src/index.js --help` | Show CLI help                              |

### Website (`website/`)
| Command            | Purpose                                            |
| ------------------ | -------------------------------------------------- |
| `npm run dev`      | Start Vite dev server with HMR                     |
| `npm run build`    | **Production build — avoid during development**    |
| `npm run lint`     | Run ESLint checks                                  |
| `npm run preview`  | Preview production build locally                   |

---

## 8. AI-Specific Guidance

When working with AI agents on this repository:

1. **Identify the target** — Are you working on the CLI tool (root) or the website (`website/`)?
2. **Use the right language** — JavaScript for CLI, TypeScript for website.
3. **Respect the architecture** — CLI is heavily modularized (`commands`, `scanner`, `ui`, `ai`, `config`).
4. **Use the Design System** — The CLI relies on a custom Markdown engine (`src/ui/markdown.js`). Format AI text beautifully using tables, blockquotes, and emojis.
5. **Security & Permissions** — Be aware of API key masking, error sanitization, and dynamic `sudo` interception for root processes.
6. **AI Tools** — When adding capabilities to the AI, define the tool schema in `src/ai/tools.js` and implement the executor in `src/ai/executor.js`.
7. **Test your changes** — Run `npm test` for CLI, manually test website in browser.
8. **Keep it fast** — The CLI is designed for speed; avoid adding unnecessary complexity or large third-party dependencies.

---

Following these practices ensures smooth development and maintains the quality and
performance standards of PortScope.