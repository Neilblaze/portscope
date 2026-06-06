import { existsSync, readFileSync } from "fs";
import { join } from "path";


// Detect which package manager is used in a project dir
export function detectPackageManager(dir) {
  if (!dir) return "npm";

  if (existsSync(join(dir, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(dir, "yarn.lock"))) return "yarn";
  if (existsSync(join(dir, "bun.lockb")) || existsSync(join(dir, "bun.lock"))) return "bun";
  return "npm";
}



// Find the dev script name from package.json
// Priority: dev > start > serve > develop
function findDevScript(dir) {
  if (!dir) return null;
  const pkgPath = join(dir, "package.json");
  if (!existsSync(pkgPath)) return null;

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    const scripts = pkg.scripts || {};

    // Priority order — "dev" is the most common for dev servers
    const candidates = ["dev", "start", "serve", "develop"];
    for (const name of candidates) {
      if (scripts[name]) return name;
    }
    return null;
  } catch {
    return null;
  }
}



const PORT_FLAGS = {
  // JS ecosystem
  "Vite": "--port",
  "Next.js": "-p",
  "React": null,
  "Angular": "--port",
  "Nuxt": "--port",
  "Remix": "--port",
  "Astro": "--port",
  "Gatsby": "-p",
  "SvelteKit": "--port",
  "Svelte": "--port",
  "Webpack": "--port",
  "Parcel": "-p",
  "esbuild": "--servedir",

  // Backend frameworks
  "Express": null,
  "Fastify": null,
  "Hono": null,
  "Koa": null,
  "NestJS": null,
  "Flask": "-p",
  "Django": null,
  "FastAPI": "--port",
  "Rails": "-p",
  "Go": null,
  "Rust": null,

  "Node.js": null,

  // MLOps
  "Jupyter": "--port",
  "Streamlit": "--server.port",
  "Gradio": null,
  "MLflow": "-p",
  "TensorBoard": "--port",
  "Ollama": null,
};


// Check if a script's content suggests it already specifies a port.
// This prevents double-specifying port (e.g., script already has `--port 3000`).
function scriptHasPort(scriptContent) {
  if (!scriptContent) return false;
  return /--port\b|-p\s+\d|PORT\s*=\s*\d|:\d{4,5}\b/.test(scriptContent);
}


/**
 * Resolve the correct dev command to relaunch a process in a given directory.
 *
 * Strategy:
 * 1. If it's a Node.js/JS project (has package.json) → detect package manager
 *    + find "dev"/"start" script → return e.g. "pnpm run dev --port 3000"
 * 2. Otherwise, fall back to framework-specific commands for non-JS stacks
 *    (Django, Flask, Rails, Go, Rust).
 * 3. Returns null if nothing can be resolved (caller should fall back to raw
 *    command from ps or kill history).
 *
 * @param {string} cwd - Working directory of the project
 * @param {string|null} framework - Detected framework (e.g., "Vite", "Next.js")
 * @param {number} [port] - Port to bind to (appended as --port flag if applicable)
 * @returns {{ command: string, cwd: string }|null}
 */
export function resolveDevCommand(cwd, framework, port) {
  if (!cwd) return null;

  // ── Node.js / JS projects ── //
  const pkgPath = join(cwd, "package.json");
  if (existsSync(pkgPath)) {
    const scriptName = findDevScript(cwd);
    if (!scriptName) return null;

    const pm = detectPackageManager(cwd);

    let cmd;
    if (pm === "yarn") {
      cmd = `yarn ${scriptName}`;
    } else {
      cmd = `${pm} run ${scriptName}`;
    }

    // Append port flag if:
    // 1. We know the port
    // 2. The framework has a known port flag
    // 3. The script content doesn't already specify a port
    if (port && framework) {
      const portFlag = PORT_FLAGS[framework];
      if (portFlag) {
        try {
          const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
          const scriptContent = pkg.scripts?.[scriptName] || "";
          if (!scriptHasPort(scriptContent)) {
            cmd += ` -- ${portFlag} ${port}`;
          }
        } catch { }
      } else if (framework === "React") {
        try {
          const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
          const scriptContent = pkg.scripts?.[scriptName] || "";
          if (!scriptHasPort(scriptContent) && scriptContent.includes("react-scripts")) {
            cmd = `PORT=${port} ${cmd}`;
          }
        } catch { }
      }
    }

    return { command: cmd, cwd };
  }

  // ── Non-JS projects ── //
  if (framework === "Django" && existsSync(join(cwd, "manage.py"))) {
    const addr = port ? `0.0.0.0:${port}` : "0.0.0.0:8000";
    return { command: `python manage.py runserver ${addr}`, cwd };
  }

  if (framework === "Flask") {
    const cmd = port
      ? `flask run -p ${port}`
      : `flask run`;
    return { command: cmd, cwd };
  }

  if (framework === "FastAPI") {
    const cmd = port
      ? `uvicorn main:app --port ${port} --reload`
      : `uvicorn main:app --reload`;
    return { command: cmd, cwd };
  }

  if (framework === "Rails" && existsSync(join(cwd, "Gemfile"))) {
    const cmd = port
      ? `bin/rails server -p ${port}`
      : `bin/rails server`;
    return { command: cmd, cwd };
  }

  if (framework === "Go" && existsSync(join(cwd, "go.mod"))) {
    return { command: `go run .`, cwd };
  }

  if (framework === "Rust" && existsSync(join(cwd, "Cargo.toml"))) {
    return { command: `cargo run`, cwd };
  }

  return null;
}
