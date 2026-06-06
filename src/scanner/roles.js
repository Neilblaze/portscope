/**
 * Role-based port classification
 *
 * A "role" is a broad category that a port/process falls into,
 * derived from its detected framework or process name.
 *
 * Roles:
 *   frontend  — UI dev servers (React, Vue, Vite, Next.js, Angular, Svelte…)
 *   backend   — API/application servers (Express, Flask, Django, Rails, FastAPI…)
 *   database  — Storage engines (PostgreSQL, MySQL, MongoDB, Redis…)
 *   runtime   — Generic runtimes with no specific framework (bare Node, Python, Go…)
 *   infra     — Infrastructure services (nginx, Docker, RabbitMQ, Kafka…)
 *   ml        — ML/AI servers (Ollama, Jupyter, Streamlit, MLflow…)
 */


const FRAMEWORK_ROLES = {
  // ── Frontend ──────────────────────────────────────────────── ||
  "Vite": "frontend",
  "Next.js": "frontend",
  "React": "frontend",
  "Vue": "frontend",
  "Angular": "frontend",
  "Svelte": "frontend",
  "SvelteKit": "frontend",
  "Nuxt": "frontend",
  "Remix": "frontend",
  "Astro": "frontend",
  "Gatsby": "frontend",
  "Webpack": "frontend",
  "Parcel": "frontend",
  "esbuild": "frontend",

  // ── Backend ───────────────────────────────────────────────── ||
  "Express": "backend",
  "Fastify": "backend",
  "Hono": "backend",
  "Koa": "backend",
  "NestJS": "backend",
  "Flask": "backend",
  "Django": "backend",
  "FastAPI": "backend",
  "Rails": "backend",
  "Ruby": "backend",

  // ── Database ──────────────────────────────────────────────── ||
  "PostgreSQL": "database",
  "MySQL": "database",
  "MongoDB": "database",
  "Redis": "database",
  "Elasticsearch": "database",
  "MinIO": "database",

  // ── Infrastructure ────────────────────────────────────────── ||
  "nginx": "infra",
  "LocalStack": "infra",
  "RabbitMQ": "infra",
  "Kafka": "infra",
  "Docker": "infra",

  // ── ML/AI ─────────────────────────────────────────────────── ||
  "Ollama": "ml",
  "vLLM": "ml",
  "Triton Inference Server": "ml",
  "llama.cpp": "ml",
  "LM Studio": "ml",
  "Jupyter": "ml",
  "Streamlit": "ml",
  "Gradio": "ml",
  "MLflow": "ml",
  "TensorBoard": "ml",

  // ── Runtime (generic) ─────────────────────────────────────── ||
  "Node.js": "runtime",
  "Python": "runtime",
  "Go": "runtime",
  "Rust": "runtime",
  "Java": "runtime",
};


// Canonical Role Names
export const ROLE_ALIASES = {
  frontend: "frontend",
  fe: "frontend",
  ui: "frontend",
  client: "frontend",

  backend: "backend",
  be: "backend",
  api: "backend",
  server: "backend",

  database: "database",
  db: "database",
  data: "database",
  storage: "database",

  infra: "infra",
  infrastructure: "infra",
  devops: "infra",

  ml: "ml",
  ai: "ml",

  runtime: "runtime",
};

export const ALL_ROLES = ["frontend", "backend", "database", "infra", "ml", "runtime"];



/**
 * Get the role for a port based on its framework.
 * Falls back heuristics on process name if framework is unknown.
 *
 * @param {object} portInfo - Port object from getListeningPorts()
 * @returns {string} - role string
 */
export function getPortRole(portInfo) {
  const fw = portInfo?.framework;
  if (fw && FRAMEWORK_ROLES[fw]) return FRAMEWORK_ROLES[fw];

  const name = (portInfo?.processName || "").toLowerCase();
  if (["node", "deno", "bun"].includes(name)) return "runtime";
  if (["python", "python3", "ruby"].includes(name)) return "runtime";
  if (["java", "go", "cargo"].includes(name)) return "runtime";
  if (["postgres", "mysql", "mongod", "redis-server"].includes(name)) return "database";
  if (["nginx", "caddy", "haproxy"].includes(name)) return "infra";

  return "runtime";
}


/**
 * Parse --filter flags from CLI args into a Set of canonical role names.
 * Accepts comma-separated values per flag: --frontend,backend or --frontend --backend
 * Also accepts --role=frontend,backend style.
 *
 * Returns null if no filter flags found (means "show all").
 *
 * @param {string[]} args
 * @returns {Set<string>|null}
 */
export function parseWatchFilters(args) {
  const roles = new Set();

  for (const arg of args) {
    if (!arg.startsWith("--")) continue;

    const raw = arg.slice(2);
    // Skip non-role flags
    if (raw === "autoreload" || raw === "ar") continue;

    const value = raw.includes("=") ? raw.split("=")[1] : raw;

    const parts = value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

    for (const part of parts) {
      const canonical = ROLE_ALIASES[part];
      if (canonical) roles.add(canonical);
    }
  }

  return roles.size > 0 ? roles : null;
}


export function formatFilterLabel(filters) {
  if (!filters) return "all";
  return [...filters].join(" + ");
}
