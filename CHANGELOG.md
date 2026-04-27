# Changelog

All notable changes to PortScope will be documented in this file.

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
- Renamed from `port-whisperer` to `portscope`
- Primary command is now `portscope` (aliases `ports`, `whoisonport` still work)
- Full process names — uses `ps` command path to resolve lsof's 9-char truncation on macOS
- NVIDIA NIM default model changed to `deepseek-ai/deepseek-v4-flash`
- System prompt: direct/professional tone, always uses markdown tables for structured data, no generic pleasantries
- Version badge right-aligned under banner for visual symmetry
- Provider selection is now interactive (removed `PORTSCOPE_AI_PROVIDER` env var)
