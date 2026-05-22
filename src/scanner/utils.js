import { existsSync } from "fs";
import { join, dirname, basename } from "path";


export function isDevProcess(processName, command) {
  const name = (processName || "").toLowerCase();
  const cmd = (command || "").toLowerCase();

  // System/desktop apps per platform
  const systemApps = [
    // macOS
    "spotify",
    "raycast",
    "tableplus",
    "postman",
    "linear",
    "cursor",
    "controlce",
    "rapportd",
    "superhuma",
    "setappage",
    "slack",
    "discord",
    "firefox",
    "chrome",
    "google",
    "safari",
    "figma",
    "notion",
    "zoom",
    "teams",
    "code",
    "iterm2",
    "warp",
    "arc",
    "loginwindow",
    "windowserver",
    "systemuise",
    "kernel_task",
    "launchd",
    "mdworker",
    "mds_stores",
    "cfprefsd",
    "coreaudio",
    "corebrightne",
    "airportd",
    "bluetoothd",
    "sharingd",
    "usernoted",
    "notificationc",
    "cloudd",
    // Linux
    "systemd",
    "snapd",
    "networkmanager",
    "gdm",
    "sshd",
    "cron",
    "dbus-daemon",
    "polkitd",
    "rsyslogd",
    "thermald",
    "accounts-daemon",
    // Windows
    "svchost",
    "csrss",
    "lsass",
    "services",
    "explorer",
    "dwm",
    "searchindexer",
    "taskhostw",
    "runtimebroker",
    "shellexperiencehost",
  ];
  for (const app of systemApps) {
    if (name.toLowerCase().startsWith(app)) return false;
  }

  // Dev process names (exact match on basename)
  const devNames = new Set([
    "node",
    "python",
    "python3",
    "ruby",
    "java",
    "go",
    "cargo",
    "deno",
    "bun",
    "php",
    "uvicorn",
    "gunicorn",
    "flask",
    "rails",
    "npm",
    "npx",
    "yarn",
    "pnpm",
    "tsc",
    "tsx",
    "esbuild",
    "rollup",
    "turbo",
    "nx",
    "jest",
    "vitest",
    "mocha",
    "pytest",
    "cypress",
    "playwright",
    "rustc",
    "dotnet",
    "gradle",
    "mvn",
    "mix",
    "elixir",
    // MLOps / Inference servers / ML tooling
    "ollama",
    "tritonserver",
    "vllm",
    "llama-server",
    "llama-cli",
    "jupyter",
    "jupyter-lab",
    "jupyter-notebook",
    "tensorboard",
    "streamlit",
    "mlflow",
    "gradio",
    "nc",
    "netcat",
  ]);
  if (devNames.has(name)) return true;

  // Docker processes (prefix match)
  if (
    name.startsWith("com.docke") ||
    name === "docker" ||
    name === "docker-sandbox"
  )
    return true;

  // Command-line keyword matching (whole words only)
  const cmdIndicators = [
    /\bnode\b/,
    /\bnext[\s-]/,
    /\bvite\b/,
    /\bnuxt\b/,
    /\bwebpack\b/,
    /\bremix\b/,
    /\bastro\b/,
    /\bgulp\b/,
    /\bng serve\b/,
    /\bgatsb/,
    /\breact-scripts\b/,
    /\bflask\b/,
    /\bdjango\b|manage\.py/,
    /\buvicorn\b/,
    /\brails\b/,
    /\bcargo\b/,
    // MLOps / Inference servers / ML tooling
    /\bollama\b/,
    /\bvllm\b/,
    /\btritonserver\b/,
    /\bjupyter\b/,
    /\btensorboard\b/,
    /\bstreamlit\b/,
    /\bgradio\b/,
    /\bmlflow\b/,
    /\bllama-server\b/,
    /\bllama-cli\b/,
  ];
  for (const re of cmdIndicators) {
    if (re.test(cmd)) return true;
  }

  return false;
}


// Walk upward from a directory to find the project root by marker files
export function findProjectRoot(dir) {
  const markers = [
    "package.json",
    "Cargo.toml",
    "go.mod",
    "pyproject.toml",
    "Gemfile",
    "pom.xml",
    "build.gradle",
  ];
  let current = dir;
  let depth = 0;
  while (current !== "/" && current !== dirname(current) && depth < 15) {
    for (const marker of markers) {
      if (existsSync(join(current, marker))) return current;
    }
    current = dirname(current);
    depth++;
  }
  return dir;
}


// Extract a short description from a full command string
export function summarizeCommand(command, processName) {
  const cmd = command || "";
  const parts = cmd.split(/\s+/);
  const meaningful = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i === 0) continue;
    if (part.startsWith("-")) continue;
    if (part.includes("/")) {
      meaningful.push(basename(part));
    } else {
      meaningful.push(part);
    }
    if (meaningful.length >= 3) break;
  }
  if (meaningful.length > 0) return meaningful.join(" ");
  return processName;
}

export function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function formatMemory(rssKB) {
  if (rssKB > 1048576) return `${(rssKB / 1048576).toFixed(1)} GB`;
  if (rssKB > 1024) return `${(rssKB / 1024).toFixed(1)} MB`;
  return `${rssKB} KB`;
}
