# PortScope

> **Version**: CLI Tool (ES Module)  
> **Platforms**: macOS · Linux · Windows  
> **Runtime**: Node.js ≥ 18  

---

## Table of Contents

- [1. Port Scanning & Discovery](#1-port-scanning--discovery)
- [2. Process Inspection](#2-process-inspection)
- [3. Process Management (Kill / Pause / Resume)](#3-process-management-kill--pause--resume)
- [4. Process Restart](#4-process-restart)
- [5. Log Inspection](#5-log-inspection)
- [6. Live Monitoring — `watch` Mode](#6-live-monitoring--watch-mode)
- [7. Live Monitoring — `list --live` Mode](#7-live-monitoring--list---live-mode)
- [8. Autoreload (Crash Recovery)](#8-autoreload-crash-recovery)
- [9. Orphan & Zombie Process Cleanup](#9-orphan--zombie-process-cleanup)
- [10. Port Topology & Connection Mapping](#10-port-topology--connection-mapping)
- [11. AI-Powered Chat Interface](#11-ai-powered-chat-interface)
- [12. Multi-Provider LLM Support](#12-multi-provider-llm-support)
- [13. Streaming Responses](#13-streaming-responses)
- [14. AI Tool Calling (Function Calling)](#14-ai-tool-calling-function-calling)
- [15. Image / Vision Support](#15-image--vision-support)
- [16. Intent Classification & Input Preprocessing](#16-intent-classification--input-preprocessing)
- [17. Prompt Injection Detection](#17-prompt-injection-detection)
- [18. Context Window Management](#18-context-window-management)
- [19. Conversation History & Persistence](#19-conversation-history--persistence)
- [20. Conversation Export](#20-conversation-export)
- [21. Token Usage & Telemetry Dashboard](#21-token-usage--telemetry-dashboard)
- [22. Slash Commands](#22-slash-commands)
- [23. Ghost-Text Autocomplete](#23-ghost-text-autocomplete)
- [24. Framework & Environment Detection](#24-framework--environment-detection)
- [25. Role-Based Port Classification](#25-role-based-port-classification)
- [26. Dev Command Resolution](#26-dev-command-resolution)
- [27. Package Manager Detection](#27-package-manager-detection)
- [28. Docker Integration](#28-docker-integration)
- [29. System Guard (OS Process Protection)](#29-system-guard-os-process-protection)
- [30. Kill History Ledger](#30-kill-history-ledger)
- [31. Sudo Interceptor (Dynamic Privilege Escalation)](#31-sudo-interceptor-dynamic-privilege-escalation)
- [32. Security & Data Sanitization](#32-security--data-sanitization)
- [33. System Stats & Memory Pressure](#33-system-stats--memory-pressure)
- [34. Platform Abstraction Layer](#34-platform-abstraction-layer)
- [35. Configuration System](#35-configuration-system)
- [36. API Key Management](#36-api-key-management)
- [37. Model Discovery & Caching](#37-model-discovery--caching)
- [38. LLM Pricing Database](#38-llm-pricing-database)
- [39. Custom Markdown Renderer](#39-custom-markdown-renderer)
- [40. UI Animations & Visual Polish](#40-ui-animations--visual-polish)
- [41. CLI Flags & Modes](#41-cli-flags--modes)
- [42. Non-Interactive / Headless Mode](#42-non-interactive--headless-mode)
- [43. Input Sanitization (Shell Injection Prevention)](#43-input-sanitization-shell-injection-prevention)

---

## 1. Port Scanning & Discovery

Discovers all TCP ports currently in a `LISTEN` state on the local machine. Uses platform-native tooling for maximum reliability and speed.

| Platform | Method |
|----------|--------|
| macOS    | `lsof -iTCP -sTCP:LISTEN -nP` |
| Linux    | `/proc/net/tcp` + `/proc/<pid>/` parsing with `ss` fallback |
| Windows  | `netstat -ano` parsed via PowerShell |

**Enrichment per port:**
- Port number and bind address
- PID, process name, full command line
- Working directory (`cwd`) — resolved via `lsof -d cwd` (macOS), `/proc/<pid>/cwd` (Linux), or `Get-Process` (Windows)
- Git branch detection (reads `.git/HEAD` from the project root)
- Framework detection (see [§24](#24-framework--environment-detection))
- Environment classification: `dev`, `prod`, `test`, `staging`
- Project name (derived from nearest `package.json`, `Cargo.toml`, `go.mod`, etc.)
- Docker container name correlation (if port is Docker-managed)
- Memory (RSS) formatted as KB/MB/GB
- Uptime (derived from process start time)
- Connection count and throughput (`bytesIn/s`, `bytesOut/s`, `requestRate`)

**Modes:**
- `portscope` / `portscope list` — Dev ports only (filtered via `isDevProcess()` heuristic)
- `portscope list --all` / `-a` — All ports including system services
- `portscope list --live` — Auto-refreshing live table (see [§7](#7-live-monitoring--list---live-mode))

---

## 2. Process Inspection

Deep-dives into a single port with detailed diagnostics.

```
portscope inspect <port>
portscope <port>          # shorthand — entering a bare port number triggers inspect
```

**Returns:**
- All fields from port scanning (§1)
- Full command string
- Process tree (parent PID chain)
- Git branch and project root
- Memory usage (RSS)
- Environment (`dev` / `prod` / `test` / `staging`)
- Docker container name (if applicable)
- Bind address

---

## 3. Process Management (Kill / Pause / Resume)

### Kill

Terminates processes by port number, PID, port ranges, comma-separated lists, or the keyword `all`.

```
portscope kill <port>
portscope kill <pid>
portscope kill 3000,3001,5000       # comma-separated
portscope kill 3000-3005            # range
portscope kill all                  # all dev server ports
portscope kill <target> -f          # force (SIGKILL instead of SIGTERM)
```

**Behavior:**
- Default signal: `SIGTERM` (graceful)
- `--force` / `-f`: `SIGKILL` (immediate)
- Validates targets against the System Guard (§29) before sending any signal
- Records kill metadata to the Kill History Ledger (§30) for later restart
- Prompts for user confirmation before execution
- Handles `EPERM` gracefully via the Sudo Interceptor (§31)

### Pause

Suspends a running process using `SIGSTOP` (freezes execution, preserving state).

```
portscope pause <port|pid>
```

- macOS/Linux only — Windows does not support `SIGSTOP`
- System Guard validated

### Resume

Resumes a previously paused process using `SIGCONT`.

```
portscope resume <port|pid>
```

- macOS/Linux only
- System Guard validated

---

## 4. Process Restart

Kills a process and immediately relaunches it using its original command and working directory.

```
portscope restart <port> [-f|--force]
```

**Restart strategies (in priority order):**

1. **Live restart** — If the port is currently occupied:
   - Captures `command`, `cwd`, `framework` from the live process
   - Runs the Dev Command Resolver (§26) to produce a clean restart command
   - Kills the existing process → waits for port to free (5s timeout) → spawns new process → polls for port rebind (8s timeout)

2. **History restart** — If the port is free but was recently killed:
   - Reads from the Kill History Ledger (§30)
   - Reconstructs the dev command from stored metadata
   - Spawns the new process and polls for port rebind

**Platform-aware dev command construction:**
- Node.js projects: `<package-manager> run <dev-script>` with correct port flag (`--port`, `-p`, `PORT=`, etc.)
- Django: `python manage.py runserver 0.0.0.0:<port>`
- Flask: `flask run -p <port>`
- FastAPI: `uvicorn main:app --port <port> --reload`
- Rails: `bin/rails server -p <port>`
- Go: `go run .`
- Rust: `cargo run`

---

## 5. Log Inspection

Tails log output for a process by port number or PID.

```
portscope logs <port|pid>
portscope logs <port1>,<port2>        # tail multiple ports simultaneously
portscope logs --all                  # tail all active dev ports simultaneously
portscope logs <port> -f              # follow (live tail)
portscope logs <port> --lines <N>     # last N lines (default: 30)
portscope logs <port> --err           # stderr only
```

**Log file discovery (platform-aware):**

| Method | Platform | Description |
|--------|----------|-------------|
| `lsof -p <pid>` | macOS/Linux | Finds open file descriptors; detects `stdout`/`stderr` redirects (`fd 1w`, `2w`) and log-like open files |
| `/proc/<pid>/fd` symlinks | Linux fallback | Reads symlinks for fd 1 (stdout), fd 2 (stderr), and any log-like targets |
| Framework log paths | All | Scans CWD for common log locations: `.next/server.log`, `logs/development.log`, `log/development.log`, `tmp/pids/server.log`, `storage/logs/laravel.log`, `npm-debug.log`, `yarn-error.log` |
| System log stream | macOS/Linux/Windows | `log stream` (macOS), `journalctl` (Linux), `Get-WinEvent` (Windows) — used when no file-based logs are found |

**Features:**
- **Multi-Port Log Interleaving**: Pass multiple comma-separated ports or `--all` to seamlessly multiplex, line-buffer, and color-prefix streams from numerous processes simultaneously into a single window.
- Priority-sorted: `stdout/stderr redirect` > `logfile` > `framework log` > `system log`
- Deduplication by file path
- Sudo Interceptor (§31) triggers on `EPERM` errors from `lsof`
- Output is truncated to 8,000 chars with an `[... N earlier lines omitted]` marker when necessary

---

## 6. Live Monitoring — `watch` Mode

Continuously monitors port activity and prints a timestamped event stream.

```
portscope watch
portscope watch --frontend            # filter by role
portscope watch --fe,be               # multiple roles (comma-separated)
portscope watch --ar                  # with autoreload (§8)
portscope watch --autoreload          # same as --ar
portscope watch --backend --ar        # combine filters + autoreload
```

**Event types:**
- `▲ NEW` — A new port starts listening
- `◆ UP` — An existing port's metadata has changed (PID, memory, connections)
- `▼ CLOSED` — A port has stopped listening

**Telemetry per event:**
- Port number, process name, PID
- Memory (RSS)
- Bind address (highlighted if `0.0.0.0`)
- Uptime
- Active connection count
- Throughput: `↑ out` / `↓ in` (bytes/s, formatted as KB/s, MB/s, etc.)
- Request rate (e.g., `12 req/s`, `1 req/5s`)

**Role-based filtering:** See [§25](#25-role-based-port-classification) for available roles and aliases.

**Exit:** `Ctrl+C` gracefully stops watch mode and returns to the interactive prompt.

---

## 7. Live Monitoring — `list --live` Mode

Auto-refreshing table view of all listening ports, re-rendering at a fixed interval.

```
portscope list --live
```

- Clears and re-renders the full port table every 2 seconds
- Shows the same enriched data as `portscope list`
- `Ctrl+C` to stop

---

## 8. Autoreload (Crash Recovery)

Automatically restarts crashed processes detected by `watch` mode.

```
portscope watch --ar
portscope watch --autoreload
```

**Behavior:**
- When a `▼ CLOSED` event fires, PortScope checks if the port should be restarted
- **User-kill detection**: If the port was recently killed via `portscope kill` (within 10s), the autorestart is skipped (`⊘ SKIP — user-initiated kill detected`)
- **Crash loop protection**: Exponential backoff with a max of 3 attempts within a 60-second window. After 3 failures, the port is **parked** (`⚠ PARKED — crashed 3 times in 60s, auto-restart disabled`)
- **Role-aware delays**: Base restart delay varies by port role:

  | Role | Base Delay |
  |------|-----------|
  | frontend | 2s |
  | backend | 3s |
  | database | 5s |
  | infra | 4s |
  | ml | 4s |
  | runtime | 3s |

- Backoff factor: 1.5× per attempt, max delay: 15s
- Port rebind timeout: 10s
- Docker-managed ports are never auto-restarted

**Confirmation prompt:** Autoreload requires explicit user consent before activation, with a warning about potential port conflicts and restart loops.

---

## 9. Orphan & Zombie Process Cleanup

Detects and cleans up orphaned or zombie dev server processes.

```
portscope clean
```

**Detection heuristic:**
- Finds processes matching dev process signatures (see `isDevProcess()` in §24) that have no listening port bound
- Filters by PPID to detect reparented/orphaned trees

**Behavior:**
- Lists all orphaned processes for review
- Sends `SIGTERM` to each; reports killed and failed PIDs
- Prompts for confirmation before killing

---

## 10. Port Topology & Connection Mapping

Maps inter-port connections between local listening services.

```
# Via AI chat or as an AI tool call
get_port_connections
get_port_connections --port <N>
```

**Returns per port:**
- Which other local listening ports it is connected to (e.g., Next.js on `:3000` → Flask backend on `:5000`)
- External (non-local) connection count
- Process name and framework for each peer

**Platform implementation:**
- macOS: `lsof -i -nP` parsing of `ESTABLISHED` connections
- Linux: `/proc/net/tcp` connection table parsing
- Windows: `netstat -ano` with state filtering

---

## 11. AI-Powered Chat Interface

A full interactive REPL for natural language interaction with PortScope.

```
portscope chat
portscope chat --verbose
```

**Capabilities:**
- Natural language queries: *"what's using port 3000?"*, *"which process is consuming the most RAM?"*, *"kill all dev servers"*
- Tool-calling loop: The AI automatically invokes the correct tool, processes results, and responds in formatted Markdown
- Destructive actions (kill, clean, restart) require `[y/N]` user confirmation via the tool executor — the AI does **not** double-confirm
- Conversation state is maintained across turns within a session
- Conversations are auto-saved to disk (§19) and can be loaded, exported, or reviewed later
- `Ctrl+C` during an API call cancels the request; `Ctrl+C` at the prompt exits the chat
- Ghost-text autocomplete (§23) for slash commands and port numbers

---

## 12. Multi-Provider LLM Support

PortScope supports 8 AI providers, switchable at runtime.

| Provider | Default Model | API Type | Streaming |
|----------|--------------|----------|-----------|
| **Anthropic** | `claude-haiku-4-5` | Anthropic Messages API | ✅ SSE |
| **OpenAI** | `gpt-5-nano` | OpenAI Chat Completions | ✅ SSE |
| **Google Gemini** | `gemini-2.5-flash` | Gemini `generateContent` | ❌ (fallback to non-streaming) |
| **OpenRouter** | `qwen/qwen3.5-flash-02-23` | OpenAI-compatible | ✅ SSE |
| **NVIDIA NIM** | `deepseek-ai/deepseek-v4-flash` | OpenAI-compatible | ✅ SSE |
| **Cerebras** | `llama-4-scout-17b-16e-instruct` | OpenAI-compatible | ✅ SSE |
| **Groq** | `llama-3.3-70b-versatile` | OpenAI-compatible | ✅ SSE |
| **Ollama** | `llama3` | Ollama `/api/chat` | ❌ (fallback to non-streaming) |

**Features:**
- Provider switching at runtime (`/provider`)
- Automatic API key discovery from environment variables and `~/.portscope/.env`
- Fallback scanning: If the configured provider has no key, PortScope automatically scans all providers for any available key
- API key validation on setup (provider-specific health checks)
- Model browsing and selection (`/models`, `/model <name>`)
- Paginated model listing with curated names for popular models
- Custom Ollama endpoint support
- Automatic retry (1 retry with 2s backoff on transient errors)
- 30s timeout (60s for Ollama) with descriptive error messages

---

## 13. Streaming Responses

Real-time token-by-token rendering of AI responses in the terminal.

**Toggle:** `/verbose` command or `--verbose` flag at startup.

**When enabled:**
- Text deltas are rendered incrementally using the custom Markdown renderer (§39)
- Viewport-aware rendering: Output is windowed to the terminal height to prevent scroll thrashing (top 5 lines + bottom N lines with `...` separator)
- Smooth "Thinking..." progress indicator with elapsed time
- Token throughput display after each response (`↔️  N tokens (X in · Y out) · Zs · W tok/s`)

**When disabled:**
- A spinner animation is shown while the AI processes
- Full response is rendered at once after completion

**Supported providers:** Anthropic, OpenAI, OpenRouter, NVIDIA NIM, Cerebras, Groq (SSE). Gemini and Ollama fall back to non-streaming.

---

## 14. AI Tool Calling (Function Calling)

The AI can autonomously invoke 11 tools to interact with the system.

| Tool | Description | Destructive? |
|------|-------------|:---:|
| `list_ports` | List all listening ports (dev-only or all) | No |
| `inspect_port` | Detailed info for a specific port | No |
| `kill_process` | Kill processes by port/PID (supports arrays) | ✅ |
| `kill_all_dev_ports` | Kill all dev server ports at once | ✅ |
| `list_processes` | List running dev processes with CPU/memory stats | No |
| `find_orphaned` | Find orphaned/zombie dev server processes | No |
| `clean_orphaned` | Kill all orphaned/zombie processes | ✅ |
| `view_logs` | View last N lines of log output for a process | No |
| `get_system_stats` | CPU load averages, memory pressure, free RAM | No |
| `restart_process` | Kill and relaunch a process by port | ✅ |
| `get_port_connections` | Map inter-port connections (topology) | No |

**Multi-round tool loop:** The AI can chain multiple tool calls in sequence (e.g., `list_ports` → `inspect_port` → `kill_process`), processing results between rounds.

**Destructive tool safety:** All tools marked ✅ require user confirmation (`[y/N]`) before execution. The AI is instructed to **never** add its own confirmation prompt on top of this.

**Tool result sanitization:** All tool results are run through the data sanitizer (§32) before being sent back to the AI, preventing accidental API key / credential leakage.

---

## 15. Image / Vision Support

Users can attach images to chat messages for multimodal analysis.

```
❯ What do you see in ~/screenshot.png
❯ Analyze the errors in ./terminal-output.jpeg
```

**Supported formats:** `.png`, `.jpg`, `.jpeg` (max 10 MB per image)

**Path resolution:**
- Absolute paths: `/path/to/file.png`
- Home-relative: `~/file.png`
- Current-dir-relative: `./file.png`

**Provider-specific encoding:**
- **Anthropic**: `type: "image"` with `source.type: "base64"`
- **OpenAI / OpenRouter / NVIDIA / Cerebras / Groq**: `type: "image_url"` with `data:` URI
- **Gemini**: `inline_data` with `mime_type` and `data`
- **Ollama**: Base64 strings in the `images` array

---

## 16. Intent Classification & Input Preprocessing

A local (no-API-call) intent classifier that runs **before** every AI request.

**Intent types:**

| Type | Action |
|------|--------|
| `port_query` | Valid port/process question → sent to AI |
| `vague` | Ambiguous input → smart suggestions shown, then sent to AI with hints |
| `off_topic` | Not related to ports/processes → blocked client-side with helpful suggestion |
| `injection_attempt` | Prompt injection detected → blocked client-side with fixed response |

**Domain keyword matching:** 60+ regex patterns covering ports, PIDs, processes, frameworks, system metrics, networking terms, and common port numbers.

**Off-topic detection:** Blocks requests for poetry, code generation, translations, recipes, weather, math homework, etc. — unless they contain domain-relevant keywords.

**Smart suggestions:** Contextual suggestions based on input keywords (e.g., "slow" → CPU/memory diagnostics, "fix" → port inspection / restart).

---

## 17. Prompt Injection Detection

Client-side defense against prompt injection and jailbreak attempts.

**Detected patterns:**
- Identity overrides: *"you are now…"*, *"pretend to be…"*, *"act as…"*
- Rule bypasses: *"ignore instructions"*, *"disregard rules"*, *"override prompt"*
- Mode switches: *"enter developer mode"*, *"DAN mode"*, *"jailbreak"*
- Prompt extraction: *"show system prompt"*, *"reveal your instructions"*
- System prompt injection markers: `[SYSTEM]`, `[INST]`, `<<SYS>>`

**Response:** Fixed, hardcoded message: *"I am PortScope. I only assist with managing local ports and processes."*

---

## 18. Context Window Management

Intelligent sliding-window conversation compaction to stay within token budgets.

**Strategy:**
1. **Hot zone** (last 3 user/assistant exchanges): Preserved verbatim with full tool results
2. **Cold zone** (older turns): Tool results are replaced with compact 1-line summaries (e.g., `[Tool: list_ports → 8 ports]`)
3. **Null stripping**: `null` and `undefined` values are recursively removed from all serialized payloads
4. **Token budget enforcement**: If estimated tokens exceed the budget (default: 32,000), the oldest cold messages are progressively pruned
5. **Automatic compaction tracking**: Number of compactions is recorded in the Usage Dashboard

**Token estimation:** `~1 token per 4 characters` heuristic for English/JSON content.

---

## 19. Conversation History & Persistence

Conversations are automatically saved to disk and can be browsed, loaded, or exported.

**Storage:** `~/.portscope/history/`
- `index.json` — Conversation index (ID, title, provider, model, timestamps, message count)
- `conv_<date>_<seq>.json` — Full conversation data per session

**Features:**
- Auto-save after each AI response
- Title derived from the first user message (truncated to 60 chars)
- Max 50 conversations retained (oldest auto-pruned)
- `/history` — List recent conversations with timestamps, message counts, and model info
- `/history <n>` — Preview a conversation (first 5 exchanges)
- `/load <n>` — Restore a previous conversation into the current session

---

## 20. Conversation Export

Export the current or loaded conversation to a file.

```
/export           # default: Markdown
/export md        # Markdown
/export html      # Styled HTML
/export txt       # Plain text
```

**Output location:** `~/Downloads/portscope-<id>.<format>` (falls back to CWD if Downloads doesn't exist)

**HTML export:** Self-contained, dark-themed HTML with Inter font, styled user/assistant message bubbles, and metadata header.

---

## 21. Token Usage & Telemetry Dashboard

Comprehensive usage tracking and visualization.

```
/usage
```

**Dashboard contents:**

| Section | Metrics |
|---------|---------|
| **Context Usage Grid** | 10×5 visual grid (`▤` = used, `◻` = free), broken down by input (cyan) vs output (magenta) tokens, percentage and absolute counts |
| **Connection Ping** | Real-time latency check to the configured provider's API endpoint, color-coded (green < 300ms, yellow < 1000ms, red > 1000ms) |
| **Cost & Metrics** | Estimated cost (from LLM pricing database), API call count, RPM, TPM, average latency, P95 latency, output/input token ratio, cost per request |

**Persistence:** Metrics are saved to `~/.portscope/metrics.json` and survive across sessions for the same provider/model combination.

**Pricing database:** 60+ models with per-token pricing, augmented by a synced `llm-pricing.json` from the LiteLLM database (§38).

---

## 22. Slash Commands

In-chat commands for configuration, history, and session management.

### Direct Commands (No AI)
| Command | Description |
|---------|-------------|
| `<port>` | Inspect a specific port |
| `kill <n>` | Kill by port, PID, range, or `all` |
| `pause <n>` | Suspend a process (SIGSTOP) |
| `resume <n>` | Resume a paused process (SIGCONT) |
| `restart <n>` | Kill & relaunch a process by port |
| `ps` | Show running dev processes |
| `list` | Refresh port table |
| `list --live` | Auto-refresh port table (LIVE) |
| `logs <n>` | Tail log output |
| `clean` | Kill orphaned/zombie servers |
| `watch` | Monitor port changes (LIVE) |
| `watch --ar` | Auto-restart crashed ports |
| `watch --fe` | Watch frontend ports only |
| `watch --fe,be` | Watch frontend + backend |

### AI & Config
| Command | Description |
|---------|-------------|
| `/provider` | Switch AI provider & add API key |
| `/revoke` | Revoke a saved API key |
| `/revoke <provider>` | Revoke a specific provider's key directly |
| `/models` | Browse and select a model |
| `/model <name>` | Set model directly |
| `/status` | Show current provider & model |
| `/usage` | Usage dashboard, context & telemetry |
| `/verbose` | Toggle verbose/streaming mode |
| `/clear` | Reset conversation history |

### History & Export
| Command | Description |
|---------|-------------|
| `/history` | List previous conversations |
| `/history <n>` | Preview a conversation |
| `/load <n>` | Restore a previous conversation |
| `/export [fmt]` | Export as `md`, `html`, or `txt` |

### Session
| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/exit` | Quit PortScope |
| `exit` / `quit` | Quit PortScope (without `/`) |

---

## 23. Ghost-Text Autocomplete

IDE-style inline suggestions rendered as dimmed gray text ahead of the cursor.

**Trigger sources:**
- **Slash commands**: `/pro` → dim `vider` (with args hint: `<name>`)
- **Direct commands**: `ki` → dim `ll <port|pid|range|all>`
- **Port numbers**: `30` → dim `00` (from cached active port list)
- **Sub-arguments**: `kill a` → dim `ll`, `logs 3000 -` → dim `f`, `list --a` → dim `ll`

**Interaction:**
- `→` (Right arrow) or `Ctrl+E`: Accept the suggestion
- `Tab` / `Enter`: Clear the suggestion and submit
- Continue typing: Suggestion updates in real-time

**Visual polish:**
- Slash commands are syntax-highlighted in yellow when they match a valid command
- ANSI cursor save/restore is used for flicker-free rendering

---

## 24. Framework & Environment Detection

Heuristic-based detection of web frameworks, runtimes, and deployment environments from process metadata.

### Framework Detection (60+ frameworks)

**Frontend:** Vite, Next.js, React (CRA), Vue, Angular, Svelte, SvelteKit, Nuxt, Remix, Astro, Gatsby, Webpack, Parcel, esbuild

**Backend:** Express, Fastify, Hono, Koa, NestJS, Flask, Django, FastAPI, Rails, Ruby, Go, Rust, Java

**Database:** PostgreSQL, MySQL, MongoDB, Redis, Elasticsearch, MinIO

**Infrastructure:** nginx, LocalStack, RabbitMQ, Kafka, Docker

**ML/AI:** Ollama, vLLM, Triton Inference Server, llama.cpp, LM Studio, Jupyter, Streamlit, Gradio, MLflow, TensorBoard

**Runtime (generic):** Node.js, Python, Go, Rust, Java, Deno, Bun

### Dev Process Detection

The `isDevProcess()` function identifies developer-relevant processes via:
1. **Exclusion list**: 50+ system/desktop apps filtered out (Spotify, Raycast, Chrome, Finder, systemd, svchost, etc.)
2. **Process name matching**: 30+ dev runtimes and tools (`node`, `python`, `cargo`, `deno`, `bun`, `ollama`, `jupyter`, etc.)
3. **Docker prefix matching**: `com.docke*`, `docker`, `docker-sandbox`
4. **Command-line keyword regex**: 20+ framework patterns (`vite`, `next`, `webpack`, `flask`, `django`, `ollama`, `streamlit`, etc.)

### Environment Detection
- `dev` / `development`
- `prod` / `production`
- `test` / `testing`
- `staging` / `stage`

Detected from `NODE_ENV`, command-line flags, and framework conventions.

---

## 25. Role-Based Port Classification

Ports are classified into 6 canonical roles based on their detected framework.

| Role | Description | Aliases |
|------|-------------|---------|
| `frontend` | UI dev servers | `fe`, `ui`, `client` |
| `backend` | API/application servers | `be`, `api`, `server` |
| `database` | Storage engines | `db`, `data`, `storage` |
| `infra` | Infrastructure services | `infrastructure`, `devops` |
| `ml` | ML/AI servers | `ai` |
| `runtime` | Generic runtimes | — |

**Used by:**
- `watch --<role>` filtering
- Autoreload delay calculation (§8)
- AI tool result enrichment

**Fallback heuristic:** If no framework is detected, the process name is matched against known binaries (e.g., `postgres` → `database`, `nginx` → `infra`, `node` → `runtime`).

---

## 26. Dev Command Resolution

Resolves the correct shell command to relaunch a dev server in a given project directory.

**Node.js / JS projects:**
1. Detect package manager (§27)
2. Find dev script in `package.json` (priority: `dev` > `start` > `serve` > `develop`)
3. Construct command: `<pm> run <script>`
4. Append port flag if the framework has a known flag and the script doesn't already specify a port

**Framework-specific port flags:**

| Framework | Flag |
|-----------|------|
| Vite | `--port` |
| Next.js | `-p` |
| Angular, Nuxt, Astro, SvelteKit | `--port` |
| React (CRA) | `PORT=<n>` (env prefix) |
| Flask | `-p` |
| FastAPI | `--port` |
| Jupyter, TensorBoard | `--port` |
| Streamlit | `--server.port` |

**Non-JS fallbacks:**
- Django → `python manage.py runserver 0.0.0.0:<port>`
- Flask → `flask run -p <port>`
- FastAPI → `uvicorn main:app --port <port> --reload`
- Rails → `bin/rails server -p <port>`
- Go → `go run .`
- Rust → `cargo run`

---

## 27. Package Manager Detection

Detects the active package manager for a Node.js project.

| Lockfile | Detected Manager |
|----------|-----------------|
| `pnpm-lock.yaml` | pnpm |
| `yarn.lock` | yarn |
| `bun.lockb` / `bun.lock` | bun |
| (default) | npm |

---

## 28. Docker Integration

Detects Docker-managed ports and correlates them with container metadata.

**Detection:**
- Process name prefix matching: `com.docke*`, `docker`, `docker-sandbox`
- `docker ps` output parsing to map ports to container names/IDs

**Safeguards:**
- Docker-managed ports cannot be restarted via `portscope restart` (user is told to use `docker restart`)
- Docker-managed ports are skipped by autoreload (§8)

---

## 29. System Guard (OS Process Protection)

Prevents PortScope from sending any signal to critical system processes.

**Always blocked:**
- PID 0 (kernel idle process)
- PID 1 (init / launchd / systemd)

**Platform-specific blocklists:**

| Platform | Protected Processes |
|----------|-------------------|
| **macOS** | `launchd`, `kernel_task`, `WindowServer`, `loginwindow`, `syslogd`, `notifyd`, `configd`, `mDNSResponder`, `opendirectoryd`, `securityd`, `bluetoothd`, `locationd`, `coreaudiod`, `fseventsd`, `apfsd`, `sshd`, and 30+ more |
| **Linux** | `systemd`, `init`, `kthreadd`, `ksoftirqd`, `rcu_*`, `watchdog`, `sshd`, `udevd`, `systemd-journald`, `dbus-daemon`, `NetworkManager`, `polkitd`, `containerd`, `dockerd`, `firewalld`, and 30+ more — plus prefix matching for kernel threads (`kworker/`, `irq/`, `migration/`, etc.) |
| **Windows** | `System`, `smss.exe`, `csrss.exe`, `wininit.exe`, `services.exe`, `lsass.exe`, `svchost.exe`, `explorer.exe`, `dwm.exe`, `taskmgr.exe`, and 15+ more |

**Return format:** `{ blocked: true, reason: "..." }` with a human-readable explanation.

---

## 30. Kill History Ledger

Records metadata about killed processes for later restart.

**Storage:** `~/.portscope/kill-history.json`

**Per-entry data:**
- Port number, PID, process name
- Full command string, working directory
- Detected framework
- Resolved dev command
- Kill timestamp (ISO 8601)

**Constraints:**
- Max 50 entries
- 12-hour TTL (entries older than 12 hours are pruned on load)
- Atomic write via `rename()` to prevent corruption
- Entries are cleared upon successful restart

---

## 31. Sudo Interceptor (Dynamic Privilege Escalation)

Handles `EPERM` / "Permission Denied" errors gracefully without requiring the user to re-run PortScope as root.

**Trigger:** Any `execSync` call that fails with a permission error (e.g., `lsof`, `kill`, `readlink`).

**Behavior:**
1. Displays: `⚠ Permission Denied. This process is owned by root.`
2. Prompts: `❯ Run this action with sudo? [y/N]`
3. If confirmed: Runs `sudo <command>` with inherited stdin/stderr (for native password prompt) and piped stdout (for output capture)
4. If declined: Returns `{ success: false, error: "User declined sudo." }`

**Windows:** Displays a message instructing the user to run PortScope as Administrator.

---

## 32. Security & Data Sanitization

Two layers of sanitization to prevent credential leakage.

### Error Sanitization (`sanitize-error.js`)

Applied to all error messages before display:
- API key patterns: `sk-*`, `api_*`, `key_*`, `apikey_*`, `secret_*` → `[REDACTED_KEY]`
- Bearer tokens → `[REDACTED_TOKEN]`
- Authorization headers → `[REDACTED]`
- JWT tokens → `[REDACTED_JWT]`
- x-api-key headers → `[REDACTED]`
- Long hex strings (32+) → `[REDACTED_HEX]`
- Base64 credentials (40+) → `[REDACTED_BASE64]`
- Nested error objects (`.cause`, `.stack`) are recursively sanitized

**Formatted error categories:**
- `🚫 Invalid Model` — Model not found
- `🔑 Auth Failed` — Invalid API key
- `📡 Provider Down` — 502/503 errors
- `⏳ Timeout` — Request timed out
- `🔌 Offline` — Connection refused (Ollama)
- `🛑 Rate Limited` — 429 / quota exceeded

### Data Sanitization (`sanitize-data.js`)

Applied to all tool results before sending to the AI:
- Same API key / Bearer / JWT / hex patterns as above
- Database connection strings with credentials: `postgres://user:pass@host` → `postgres://[REDACTED]@host`
- Inline env var assignments with sensitive names (`PASSWORD=`, `SECRET_KEY=`, `DATABASE_URL=`, etc.) → `VAR=[REDACTED]`
- PEM private key blocks → `[REDACTED_PRIVATE_KEY]`
- AWS access key IDs (`AKIA*`) → `[REDACTED_AWS_KEY]`
- User-configurable custom regex patterns via `config.ai.sanitizePatterns`

---

## 33. System Stats & Memory Pressure

Reports machine-wide resource usage.

**Available via:** `get_system_stats` AI tool, or natural language queries like *"is my machine slow?"*

**Metrics:**
- **Memory**: Total, free, used (GB), pressure percentage
- **CPU**: Core count, 1m/5m/15m load averages
- **System uptime** (seconds)

**Platform-accurate available memory:**
- **Linux**: Reads `MemAvailable` from `/proc/meminfo` (includes reclaimable buffers/cache)
- **macOS**: Runs `vm_stat` and sums `Pages free + inactive + speculative × page size`
- **Fallback**: `os.freemem()` (completely unallocated memory only)

---

## 34. Platform Abstraction Layer

Lazy-loaded OS-specific modules that provide consistent APIs for:
- Port scanning (`getListeningPorts`, `getPortDetails`)
- Port polling/watching (`watchPorts`)
- Port topology mapping (`getPortTopology`)
- Process information retrieval

**Modules:**
- `platform/darwin.js` — macOS implementation (7.6 KB)
- `platform/linux.js` — Linux implementation (11.9 KB)
- `platform/win32.js` — Windows implementation (10.9 KB)

Each module exports the same function signatures, loaded dynamically based on `process.platform`.

---

## 35. Configuration System

Layered configuration with multiple sources.

**Config file search order:**
1. `./portscope.config.json` (project-local)
2. `~/.portscope.config.json` (user-global)
3. Built-in defaults

**Environment variables:**
- `PORTSCOPE_AI_PROVIDER` — Override the AI provider
- Provider-specific API keys: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `NVIDIA_API_KEY`, `CEREBRAS_API_KEY`, `GROQ_API_KEY`

**Dotenv loading:**
- `./env` (CWD)
- `~/.portscope/.env` (global)
- Custom minimal parser (no `dotenv` dependency): Supports comments, quoted values, inline comments

**Persisted state:** `~/.portscope/config.json` stores last-used provider, model, and Ollama endpoint.

**Default config:**
```json
{
  "ai": {
    "provider": "anthropic",
    "model": null,
    "maxTokens": 4096,
    "maxContextTokens": 32000,
    "sanitizePatterns": []
  },
  "display": {
    "showBanner": true
  }
}
```

---

## 36. API Key Management

Secure lifecycle for LLM API keys.

| Operation | Method |
|-----------|--------|
| **Discovery** | Env vars → `~/.portscope/.env` → fallback scan all providers |
| **Save** | Written to `~/.portscope/.env` with `chmod 600` permissions |
| **Validate** | Provider-specific health check before saving (Anthropic: POST test, OpenAI: GET /models, Gemini: GET /models, Ollama: GET /api/tags) |
| **Display** | Masked with `maskApiKey()`: first 5 + `***...***` + last 4 characters |
| **Revoke** | `/revoke` — removes from `~/.portscope/.env` and `process.env`, prompts to configure a replacement |
| **Revoke (direct)** | `/revoke <provider>` — revoke a specific provider's key without interactive selection |

---

## 37. Model Discovery & Caching

Dynamic model listing with intelligent caching.

**Cache location:** `~/.portscope/models-cache.json`  
**Cache TTL:** 12 hours  
**Cache key:** `<provider>:<sha256(apiKey)[:16]>`

**Sources (in priority order):**
1. Live API fetch from the provider's models endpoint
2. Local `llm-pricing.json` database (fallback if API fails)
3. Curated hardcoded model list per provider (merged with fetched results)

**Model filtering:**
- Removes non-chat models: embedding, TTS, Whisper, DALL-E, audio, moderation, Codex, etc.
- Deduplicates dated variants (e.g., `gpt-4o-2024-05-13` removed if `gpt-4o` exists)
- OpenAI-specific: Only shows models matching `gpt-*`, `o1`, `o3`, `o4`, `chatgpt-*`

**Auto-discovery:** If the configured model is not in the cache, a background fetch is triggered to update the cache.

---

## 38. LLM Pricing Database

Bundled and auto-synced pricing data for cost estimation.

**Bundled:** `src/data/llm-pricing.json` (1.5 MB, LiteLLM format)  
**Sync:** Fetched from GitHub every 24 hours → cached at `~/.portscope/pricing.json`

**Coverage:** 60+ hardcoded model prices + thousands of models from the LiteLLM database.

**Price format:** `[input_cost_per_1M_tokens, output_cost_per_1M_tokens]` in USD.

**Resolution strategy:** Direct match → provider-prefixed match → substring match → prefix match.

---

## 39. Custom Markdown Renderer

A terminal-native Markdown renderer (`src/ui/markdown.js`) that converts AI text responses into beautifully styled CLI output.

**Supported elements:**
- **Tables**: Rendered as box-drawing tables using `cli-table3` with proper column alignment
- **Headers**: Bold, color-coded (`#` → cyan bold, `##` → white bold, etc.)
- **Bold/Italic/Code**: ANSI-styled inline formatting
- **Code blocks**: Syntax-highlighted with language labels
- **Blockquotes**: Indented with `│` sidebar
- **Lists**: Ordered and unordered with proper indentation
- **Line wrapping**: ANSI-aware word wrapping using `string-width` for correct CJK and emoji handling

---

## 40. UI Animations & Visual Polish

**Staggered print:** Lines appear one at a time with a 35ms delay for a reveal effect.

**Sweep clear:** Lines are wiped bottom-to-top with a 20ms per-line sweep animation.

**Flash success:** Briefly highlights a success message with a green background, then settles to a green checkmark.

**Spinner:** Animated thinking indicator during non-streaming API calls.

**Tool execution glow:** A pulsing `⚡` bolt animation cycles through amber/gold shades while a tool executes.

**Banner:** ASCII art banner rendered on startup.

---

## 41. CLI Flags & Modes

| Flag/Argument | Description |
|---------------|-------------|
| `portscope` | Interactive mode (port table + chat REPL) |
| `portscope list` | List listening dev ports |
| `portscope list --all` / `-a` | List all listening ports |
| `portscope list --live` | Auto-refreshing port table |
| `portscope <port>` | Inspect a specific port |
| `portscope inspect <port>` | Same as above |
| `portscope kill <targets>` | Kill processes |
| `portscope kill all` | Kill all dev ports |
| `portscope pause <port\|pid>` | Suspend process |
| `portscope resume <port\|pid>` | Resume process |
| `portscope restart <port>` | Restart process |
| `portscope logs <port>` | Tail logs |
| `portscope logs <port> -f` | Follow logs |
| `portscope logs <port> --lines N` | Last N lines |
| `portscope logs <port> --err` | Stderr only |
| `portscope ps` | List dev processes |
| `portscope ps --all` | List all processes |
| `portscope clean` | Kill orphans |
| `portscope watch` | Live port monitor |
| `portscope watch --ar` | Watch + autoreload |
| `portscope chat` | AI chat mode |
| `portscope chat --verbose` | Chat with streaming |
| `portscope --help` / `-h` | Show help |
| `portscope --version` / `-v` | Show version |

---

## 42. Non-Interactive / Headless Mode

Tool executions can run in headless mode (e.g., via the AI tool executor) where destructive operation confirmations are bypassed.

**Used by:** The AI executor when `options.headless` is true, allowing programmatic tool execution without interactive prompts.

---

## 43. Input Sanitization (Shell Injection Prevention)

All values interpolated into shell commands are validated:

**`assertSafeInt(val)`:**
- Ensures the value is a valid positive integer within `0 – 4,294,967,295`
- Used for PIDs and port numbers

**`sanitizePath(p)`:**
- Rejects paths containing shell metacharacters: `;`, `&`, `|`, `` ` ``, `$`, `(`, `)`, `{`, `}`, `!`, `\n`, `\r`, `\0`
- Used before interpolating file paths into `execSync()` calls (e.g., `tail -n N "path"`)
