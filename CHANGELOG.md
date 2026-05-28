# Changelog

All notable changes to PortScope will be documented in this file.

## [1.7.1] - 2026-05-28

### Added
- **`portscope restart <port>`** — Kill and relaunch a process using its original command and working directory. Works from the CLI (`portscope restart 3000`), the interactive REPL (`restart 3000`), and via natural language through the AI (`restart_process` tool). Supports `--force` / `-f` flag for `SIGKILL`. Includes Docker-process guard, quote-aware command parser (no `shell: true`), and dual polling loops that wait for the port to become free before relaunching and then confirm the new PID is bound.
- **`restart_process` AI tool** — New tool available to all AI providers and MCP clients. Marked as destructive (requires confirmation in interactive mode, runs headlessly via MCP).

### Fixed
- **MCP server version hardcoded** — The MCP server was advertising `version: "1.7.0"` as a literal string. Now reads from `src/version.js` (which sources `package.json`) so MCP clients always see the correct version without a manual edit per release.
- **Cerebras default model in README** — The supported-providers table listed `llama3.3-70b` for Cerebras; corrected to `llama-4-scout-17b-16e-instruct` to match `src/config/schema.js`.

## [1.7.0] - 2026-05-25

### Added
- **MCP Server Support** — PortScope can now act as a Model Context Protocol (MCP) server! This allows external AI agents (like Claude Desktop, Cursor) to securely use PortScope's port scanning and process management tools.
- **Dual Transports for MCP** — Fully supports both `stdio` (for local MCP clients) and `sse` (Server-Sent Events, for remote/network orchestration).
- **Headless Execution** — Added a `headless` mode to bypass interactive CLI prompts for destructive actions when tools are invoked over MCP, gracefully deferring confirmation to the MCP client.
- **MCP Prompts** — Added `portscope-help` prompt to provide immediate usage examples and syntax guidelines to connected AI agents.
- **MCP Resources** — Added `portscope://status` resource endpoint for real-time monitoring of the MCP server's uptime and memory usage.
- **MCP Environment Configuration** — The server now parses `.env` automatically, allowing you to set `PORTSCOPE_MCP_PORT` to configure the SSE server port.

## [1.6.3] - 2026-05-25

### Fixed
- **Ctrl+C Ghost Process Fix** — Resolved a critical UI lifecycle bug where hitting `Ctrl+C` during `watch` mode inside the interactive REPL would incorrectly close the global `readline` interface. The `watch` interval would continue running as a hidden "ghost" process, dumping logs sporadically. `Ctrl+C` now correctly forwards `SIGINT` directly to the active command, cleanly stopping `watch` and instantly returning you to the main prompt.

## [1.6.2] - 2026-05-24
### Added
- **Watch Mode Metrics Upgrade** — Greatly enhanced `watch` mode with live readouts for Memory Usage (RAM), Process Uptime, Bind Address (127.0.0.1 vs 0.0.0.0 network exposure), Process ID (PID), and active Bandwidth / Throughput (`↑...B/s ↓...B/s`).

### Changed
- **Direct AI Answers** — Adjusted the AI assistant's system prompt to enforce "Direct Answers First". The assistant will now provide direct conversational answers to explicit questions (e.g., "what process is consuming max ram?") *before* outputting summary tables, making it feel much more intelligent.
- **Watch Mode UI Refinements** — Streamlined the `watch` interface by fusing process name and PID, simplifying update labels, and perfectly aligning columns by keeping the throughput metrics locked in position and dynamically appending request rates to the very end of active server rows.
- **Layout Jitter Fixes** — Resolved severe initial layout jitter and misalignment in `watch` mode by pre-seeding existing ports and keeping column reservations consistent.

## [1.6.1] - 2026-05-23

### Added
- **System Telemetry Tool** — Added `get_system_stats()` AI tool utilizing the native Node.js `os` module to fetch system-wide CPU load, memory pressure, and available RAM, enabling the assistant to diagnose machine-level performance bottlenecks.
- **Self-Elevating Sudo Interceptor** — Automatically intercepts permission denied (`EPERM`) errors for root-owned processes. Dynamically prompts the user (`❯ Run this action with sudo? [y/N]`) inside the REPL, temporarily elevating permissions to fetch logs or terminate protected processes without requiring a full CLI restart.

### Changed
- **Aesthetic Telemetry Output** — The AI now formats system diagnostic data natively as a highly styled Markdown table with color-coded status emojis (🟢 Normal, 🟡 Moderate, 🔴 High) and encapsulated blockquote summaries.
- **Smart Metric Colorization** — Upgraded the custom Markdown renderer to automatically color-code status keywords (Normal, Moderate, High, Critical) in AI responses. Engineered a negative lookbehind/lookahead regex to safely ignore hyphenated compound words (e.g., `high-memory`).
- **Blockquote Wrapping & Styling** — Improved Markdown blockquote (`>`) rendering in the terminal. Blockquotes are now properly wrapped via `wrapAnsi` to prevent layout breaking, padded accurately, and prefixed with a vibrant `💡` icon for a premium UX.


## [1.6.0] - 2026-05-22

### Added
- **Verbose & Streaming AI** — Added a `/verbose` interactive toggle and `--verbose` CLI flag to enable real-time SSE streaming for supported AI providers (Anthropic, OpenAI, OpenRouter, NVIDIA, Cerebras, Groq). Displays real-time progress indicators, token metrics, latency stats, and detailed tool execution data. Falls back gracefully to non-streaming.
- **Contextual Port Suggestions** — Enhanced the ghost-text interface to intelligently suggest active port numbers from a cached list when typing port-accepting commands (`kill`, `pause`, `resume`, `logs`, `inspect`). Type `kill 3` to auto-suggest `kill 3000` if port 3000 is active.

### Fixed
- **History File Crash** — Resolved a crash on startup where legacy, corrupted history entries missing a `conversationId` caused the CLI to fail during initialization.
- **Interactive Mode ID Sync** — Fixed an issue where new conversations started in interactive mode lacked a unique `conversationId`, preventing them from properly saving their chat history.
- **Ghost-text Rendering Conflict** — Fixed terminal UI artifacts and overlapping text bugs caused when readline processed Tab or Enter key completions simultaneously with the custom suggestion renderer.
- **Logs Fall-Through Bug** — Patched a fall-through execution bug in the `logs` command that caused the CLI to display misleading secondary status messages after successfully tailing logs.
- **React/Vite Port Identification** — Improved framework detection to prioritize React over Vite and explicitly detect Create React App (`react-scripts`), ensuring accurate environment tagging for React applications.

### Changed
- **Smart System Prompt** — The AI system prompt is now more conversational when asked about its core capabilities (e.g., "what can portscope do?"), overriding the restrictive greeting fallback to provide helpful command summaries.

## [1.5.1] - 2026-05-11

### Fixed
- **Invalid API Key Error** - Fixed a bug where the CLI would crash when an invalid API key was provided for an AI provider. The CLI now prompts the user to clear the invalid API key and restart the CLI.

## [1.5.0] - 2026-05-10

### Added
- **Environment Detection** — PortScope now automatically detects and displays the runtime environment (development, production, test, staging) for each process. Added new `ENV` column in the port table between `FRAMEWORK` and `UPTIME`, showing color-coded environment indicators: green (dev), yellow (prod), blue (test), magenta (stage).
- **Live Traffic Visibility in Watch Mode** — `portscope watch` now displays active connection counts and request rates (req/s) for each port in real-time. Shows connection metrics when ports are discovered and updates when traffic patterns change, helping identify load issues and monitor live traffic without additional tools.
- **Added Autocomplete Suggestions** — Implemented intelligent autocomplete suggestions for slash commands and direct commands as you type, similar to fish shell's autosuggestions. Press right arrow or Ctrl+E to accept suggestions. No third-party dependencies required.
- **Enhanced Help UI** — Updated help text section headers with vibrant orange color (`rgb(255, 140, 0)`) for better visual hierarchy and improved readability. Sections "Direct Commands", "AI & Config", and "History & Export" now stand out prominently.
- **Comprehensive Environment Detection** — Supports 15+ frameworks including Node.js (Next.js, Vite, Nuxt), Python (Django, Flask, FastAPI), Ruby (Rails), and detects from environment variables (`NODE_ENV`, `RAILS_ENV`, `DJANGO_SETTINGS_MODULE`), command-line flags (`--env=`, `--mode=`, `--production`), and process patterns (npm scripts, nodemon, pm2, gunicorn).
- **API Key Masking** — Enhanced security by automatically masking API keys when displayed in the CLI. Keys now show only the first 5 and last 4 characters (e.g., `sk-12***************mnop`), preventing exposure during screen sharing, screenshots, or shoulder surfing. Applies to all cloud providers (Anthropic, OpenAI, Gemini, OpenRouter, NVIDIA, Cerebras, Groq) while preserving "local" for Ollama. Visible in `/provider` setup flow and `/status` command output.
- **Provider Switch Confirmation** — Added safety warning when switching AI providers mid-conversation. Users are now prompted to confirm before switching, preventing accidental loss of conversation history. The warning displays when active messages exist and offers the option to cancel. Upon confirmation, conversation history is automatically cleared and usage metrics are reset.
- **Error Sanitization** — Implemented comprehensive error message sanitization to prevent sensitive data leakage in logs and error displays. Automatically redacts API keys, Bearer tokens, Authorization headers, JWT tokens, base64-encoded credentials, and long hex strings from all error messages. Protects against accidental exposure of secrets in error logs, stack traces, and console output.
- **API Key Revocation** — Added a dedicated `/revoke` command to securely remove configured API keys from local storage. The interactive flow displays active keys, requires confirmation, and gracefully resets the active provider if its key is revoked.

### Changed
- **Command Alignment** — Improved visual alignment in interactive mode so command shortcuts align perfectly with the "Ask" text above for better readability.
- **Test Suite Expansion** — Expanded test coverage from 120 to 207 tests, adding 31 environment detection tests, 7 format tests, 14 ghost text suggestion tests, 10 API key masking tests, 4 provider switch confirmation tests, and 21 error sanitization tests. All tests passing with zero failures.
- **Enhanced Watch Mode Alignment** — All columns in watch mode now align perfectly with right-aligned numeric values. Process names are left-padded to a consistent width, connection counts and request rates stack vertically, and separators line up across all rows for improved readability.
- **Improved Status Display** — The `/status` command now shows masked API keys with enhanced formatting, displaying a checkmark with the masked key for configured providers, "✓ local" for Ollama, and "✕ missing" for unconfigured providers.
- **Safer Provider Switching** — Switching AI providers now requires explicit confirmation when an active conversation exists, preventing accidental data loss. Conversation history and usage metrics are automatically cleared after confirmation.
- **UI Aesthetics** — Replaced the legacy 3x3 dot grid spinner with a sleek single-line braille spinner and added a dynamic ghost text shimmer effect to the AI loading verb for a more premium feel.
- **Secure Error Handling** — All error messages throughout the application are now automatically sanitized before display, preventing accidental exposure of API keys, tokens, and other sensitive credentials in error logs and console output.

### Fixed
- **Markdown Table Alignment** — Resolved a visual bug where terminal table borders were misaligned by 2 spaces due to inconsistent padding logic between the markdown renderer and the interactive console loop.
- **Model Selection Persistence** — Fixed a bug where selecting an AI model via the interactive `/model` paginated list failed to save the choice to the configuration file, causing the CLI to revert to the previous model upon restart.
- **Watch Command Ctrl+C Crash** — Resolved critical bug where pressing Ctrl+C in watch mode would cause `ERR_USE_AFTER_CLOSE` readline error. Fixed by using `process.once()` instead of `process.on()` for SIGINT handlers and adding readline state checks before prompting. Watch command now exits cleanly without crashes.
- **SIGINT Handler Conflicts** — Eliminated conflicting SIGINT handlers between interactive mode and watch command that caused readline interface to close prematurely. Added proper cleanup with `process.off()` to remove handlers after use.
- **Readline State Management** — Added defensive checks (`!rl.closed`) in 5 critical locations throughout the interactive prompt loop to prevent attempting operations on closed readline interfaces.
- **Lingering Spinner on Auth Error** — Fixed a bug where the "Flowing..." spinner would linger on the console when an AI provider returned an authentication error (like an expired API key). The execution loop now properly guarantees cleanup using `try...finally` blocks.
- **Conversation State Corruption** — Fixed a bug where an API or authentication error would leave unanswered user prompts in the conversation history. The application now intelligently removes failed user inputs from the history, allowing users to cleanly retry their prompts after fixing their credentials.

### Technical
- **New Modules**: `src/scanner/environment.js` (350 lines), `src/ui/ghost-text.js` (290 lines), `src/config/mask.js` (25 lines), `src/config/sanitize-error.js` (70 lines)
- **New Tests**: `tests/environment.test.js` (31 tests), `tests/format.test.js` (7 tests), `tests/ghost-text.test.js` (14 tests), `tests/mask.test.js` (10 tests), `tests/provider-switch.test.js` (4 tests), `tests/sanitize-error.test.js` (21 tests)
- **Cross-Platform**: Environment detection works on Linux (reads `/proc/<pid>/environ`), macOS (uses `ps eww`), and Windows (limited support via `wmic`)
- **Security**: API keys stored in `~/.portscope/.env` with file permissions set to `0o600` (read/write owner only). All error messages automatically sanitized to prevent credential leakage. Supports redaction of API keys (sk-*, api_*, key_*), Bearer tokens, Authorization headers, JWT tokens, base64 credentials, and hex strings.
- **UX Enhancement**: Provider switching now includes conversation state validation and automatic cleanup

## [1.4.0] - 2026-04-29

### Added
- **Expanded AI Ecosystem** — Added full support for Google Gemini, Cerebras, and Groq inference providers, expanding the total provider count to 8. Integrated their respective fast-inference models and custom API authentication schemas.
- **Empty State Modernization** — Replaced basic text "Not Found" terminal messages for inactive port/process views with professional, high-fidelity ASCII "Bento" UI panels.
- **Unified Observability Dashboard** — Consolidated additional metrics into the main `/usage` command. Introduced a beautifully engineered 128k context utilization grid and real-time connectivity status metrics.
- **Model-Specific Usage Persistence** — `portscope` now automatically saves and persists `session` metrics to `~/.portscope/metrics.json`. Usage stats remain intact across restarts, automatically resetting only when a different AI provider or model is explicitly selected.

## [1.3.0] - 2026-04-28

### Added
- **Animated Process Spinner** — Replaced static UI indicators with an animated 3×3 spiraling grid (`src/ui/spinner.js`) that uses over 140 randomly selected, fun action verbs.
- **Token & Cost Tracking** — Implemented `src/ai/usage.js` to accumulate token consumption across all providers and estimate session costs via a new `/usage` slash command.
- **Conversation History & Export** — Automatically saves AI sessions locally. Introduced `/history`, `/load <n>`, and `/export [md|html|txt]` commands to easily restore or save conversations.
- **Vision Model Support** — Added `src/ai/image.js` to automatically extract and base64-encode image paths (e.g., `.png`, `.jpg`) provided in chat, seamlessly passing them to supported multimodal LLMs.
- **Micro-Animations** — Added `src/ui/animate.js` to provide high-end CLI visual flair, including staggered text reveals for help menus and flashing success indicators for commands like `/clear`.

### Changed
- **Security Hardening** — Mitigated shell injection vulnerabilities by introducing strict integer checks for PIDs and shell-safe path sanitization (`src/scanner/sanitize.js`).
- **File Permissions** — Local configurations and environment variables (`.env`, `config.json`) are now strictly generated with `0o600` permissions inside a `0o700` restricted `~/.portscope` directory.
- **API Resilience** — Integrated exponential backoff and retry mechanisms into `src/ai/client.js` to gracefully handle transient network timeouts or 502 Bad Gateway errors.
- **Graceful Shutdowns** — Fixed process lifecycle bugs in `watch` and `logs` commands where hard `process.exit(0)` calls were creating zombie processes. Signal handlers now allow the event loop to drain naturally.

### Fixed
- Patched a prototype pollution vulnerability inside the internal `deepMerge` utility.
- Resolved an issue in the `.env` parser where inline comments were not safely stripped.
- Fixed an `export` bug where unreferenced variables caused errors when no previous text messages existed.
- Added explicit `npm test` step to CI workflows to prevent regressions. Test suite expanded to 120 robust tests.

## [1.2.0] - 2026-04-27

### Added
- **Product Website** — Developed a fully responsive, single-page product website using React, Vite, and Tailwind CSS (`/website`)
- **Aesthetic UI Components** — Added a dynamic `PackageInstallerTabs` component modeled after premium IDE terminals, glassmorphic feature grids, and a rich 4-column aesthetic footer
- **Fluidic Background Canvas** — Integrated a highly customized `CrypticFluidBackground` component utilizing HTML5 Canvas and complex sine waves to simulate a matrix-like faded fluidic flow that dynamically adapts to both light and dark themes
- **Circular View Transitions** — Replaced standard dark mode crossfades with a native `document.startViewTransition` API implementation, providing a flawless expanding radial gradient effect
- **GitHub Pages CI/CD** — Configured `.github/workflows/deploy-website.yml` to automatically build and securely deploy the Vite React app to `neilblaze.github.io/portscope` whenever changes hit the `website/` directory

### Changed
- Refined typography by adopting the clean, geometric `Lexend` font across all feature headers
- Updated Vite configuration to inherently resolve relative `/portscope/` asset paths for seamless GitHub Pages routing

---

## [1.1.1] - 2026-04-27

### Added
- **Mocking Scripts** — Added `mock-healthy.sh`, `mock-orphaned.sh`, `mock-paused.sh`, and `mock-multiple.sh` in the `scripts/` directory to natively simulate deterministic port states for robust local QA testing
- **Contributor Guidelines** — Mapped explicit codebase setup, testing loops, and CI deployment instructions via `.docs/CONTRIBUTING.md`

### Fixed
- **Batch AI Permitted Confirmations** — Elevated the `kill_process` tool parameter schema from a solitary `target` to a bulk `targets` array object. This allows the internal LLM executor to loop destructively in the background under *a single, unified user prompt* (e.g., "kill ports 2400-2410"), massively reducing prompt fatigue
- **Eager Natural CLI Intent Clashes** — Resolved a highly confusing bug where typing *"list ports again"* or *"kill ports ... "* locally broke the direct-command router simply because they started with standard CLI keywords. Natural sentences explicitly bypass the command regex engine now, seamlessly falling through to the AI
- **Repetitive ASCII Banner Spam** — Suppressed visual dashboard logo repainting conditionally inside `src/ui/tables.js` and `src/commands/interactive.js`, so typing explicit CLI functions dynamically renders isolated grids without the distracting logo banner jumping continuously
- **Markdown Table Alignment Gap** — Buffered left-padded alignment spaces (`"  "`) dynamically for AI `cli-table3` outputs ensuring rigid visual uniformity with the rest of the application
- **Invisible Sandbox Nodes** — Explicitly whitelisted UNIX socket binaries (`nc` / `netcat`) inside `src/scanner/utils.js`, guaranteeing local shell mock environments render by default without requiring `--all`
- **422 Sigstore Check & 403 Git Actions Loop** — Pushed complete automated release modifications connecting seamlessly to `npm.pkg.github.com` using nested `GITHUB_TOKEN` explicit scope
- **Horizontal Terminal Overflows** — Segregated the UI direct commands help bar spanning across two layers to inherently prevent jarring narrow-terminal text breaks

## [1.1.0] - 2026-04-27

### Added
- **MLOps & Inference Server Detection** — PortScope now recognizes `vLLM`, `Triton Inference Server`, `Ollama`, `llama.cpp`, `LM Studio`, `Jupyter` (Notebook/Lab), `TensorBoard`, `Gradio`, `Streamlit`, and `MLflow` via command heuristics, Docker image matching, and process name detection
- **Ollama (Local AI) Provider** — air-gapped, cost-free AI chat using local Ollama models (e.g., `llama3`, `qwen2.5-coder`). Auto-detects `http://localhost:11434` — no API key required. Select via `/provider` → Ollama
- **Process Pause/Resume** — `portscope pause <port|pid>` sends `SIGSTOP` to suspend a process; `portscope resume <port|pid>` sends `SIGCONT` to resume it. Useful for temporarily freeing resources (e.g., pausing a 10GB inference server to run a Docker build)
- **Test Suite** — `npm test` runs 102 tests using Node.js built-in `node:test` runner (zero new dependencies). Covers framework detection, utility functions, config schema, and signal dispatch

### Changed
- Framework detection expanded from 30+ to 40+ recognized frameworks/tools
- `PROVIDER_IDS` now includes `ollama` alongside `anthropic`, `openai`, `openrouter`, `nvidia`
- Help output and interactive tip bar updated with `pause`/`resume` commands

---

## [1.0.1] - 2026-04-26

### Added
- **First-message welcome intro** — on the user's first AI query, PortScope shows a one-time overview of available actions before the AI responds
- **Direct commands in tip bar** — `kill`, `ps`, `logs`, `clean`, `watch`, `<port>` (inspect) are now shown inline beneath the port table so users can act immediately without AI
- Ghost placeholder updated to "Type a command or say hi to PortScope ..."

### Fixed
- **OpenAI `max_tokens` error** — newer OpenAI models (`gpt-5-nano`, `o3-mini`) reject `max_tokens`; now sends `max_completion_tokens` for OpenAI and `max_tokens` for OpenRouter/NVIDIA NIM
- **REPL crash on direct commands** — fixed a double-echo and sudden-exit bug when natively running `kill all` or `clean` inside the interactive prompt

### Changed
- Help output header now says "Direct Commands (no AI needed)" for clarity

---

## [1.0.0] - 2026-04-26

### Added
- Interactive REPL — `portscope` stays alive after showing ports; type commands or ask questions naturally
- AI chat with natural language port management (Anthropic, OpenAI, OpenRouter, NVIDIA NIM)
- Terminal markdown rendering — AI responses render **bold**, *italic*, `code`, tables (╭╮╰╯), blockquotes (│), and bullet points natively
- AI responses now render port/process listings as cli-table3 tables (same rounded-corner format as native output)
- Tab-autocomplete for slash commands (type `/` then press `Tab`)
- Interactive provider setup via `/provider` with API key validation and persistent storage
- Provider and model choices persist across restarts (`~/.portscope/config.json`)
- Ghost placeholder prompt — "Say hi to PortScope ..." hint on first launch
- Live model browsing for OpenRouter and NVIDIA NIM via `/models`
- `portscope kill all` — kill all dev server ports with mandatory `y/N` confirmation
- Comma-separated port killing: `portscope kill 3000,5173,8080`
- 8-bit ASCII art splash banner with gradient coloring
- Rounded-corner table rendering (`╭╮╰╯`)
- 30+ framework auto-detection
- Cross-platform support (macOS, Linux, Windows)
- GitHub Actions CI/CD: release, PR checks (3×3 matrix), stale bot
- Structured issue templates (bug report, feature request)

### Fixed
- **Double-echo on y/N prompts** — executor was creating a second readline on the same stdin; now reuses the REPL's readline
- **Sudden exit after declining kill** — closing the executor's readline cascaded to the REPL's readline and killed the process
- **API key not detected on restart** — provider choice wasn't persisted; config defaulted to anthropic on every restart
- **NVIDIA 502 showing raw HTML** — error responses now strip HTML tags and show friendly message with model-switch hint
- API requests now have a 30s timeout with clear error messaging instead of hanging indefinitely
- Terminal now clears npm's noisy header (`> portscope@1.0.0 dev`) on interactive startup

### Changed
- Full process names — uses `ps` command path to resolve lsof's 9-char truncation on macOS
- NVIDIA NIM default model changed to `deepseek-ai/deepseek-v4-flash`
- System prompt: direct/professional tone, always uses markdown tables for structured data, no generic pleasantries
- Version badge right-aligned under banner for visual symmetry
- Provider selection is now interactive (removed `PORTSCOPE_AI_PROVIDER` env var)
