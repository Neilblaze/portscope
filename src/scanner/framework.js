import { existsSync, readFileSync } from "fs";
import { join } from "path";

export function detectFrameworkFromImage(image) {
  if (!image) return "Docker";
  const img = image.toLowerCase();
  if (img.includes("postgres")) return "PostgreSQL";
  if (img.includes("redis")) return "Redis";
  if (img.includes("mysql") || img.includes("mariadb")) return "MySQL";
  if (img.includes("mongo")) return "MongoDB";
  if (img.includes("nginx")) return "nginx";
  if (img.includes("localstack")) return "LocalStack";
  if (img.includes("rabbitmq")) return "RabbitMQ";
  if (img.includes("kafka")) return "Kafka";
  if (img.includes("elasticsearch") || img.includes("opensearch"))
    return "Elasticsearch";
  if (img.includes("minio")) return "MinIO";


  // MLOps / Inference servers
  if (img.includes("vllm")) return "vLLM";
  if (img.includes("tritonserver") || img.includes("triton")) return "Triton Inference Server";
  if (img.includes("ollama")) return "Ollama";
  if (img.includes("jupyter")) return "Jupyter";
  if (img.includes("tensorboard")) return "TensorBoard";
  if (img.includes("mlflow")) return "MLflow";
  if (img.includes("streamlit")) return "Streamlit";
  if (img.includes("gradio")) return "Gradio";
  return "Docker";
}

export function detectFramework(projectRoot) {
  const pkgPath = join(projectRoot, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (allDeps["next"]) return "Next.js";
      if (allDeps["nuxt"] || allDeps["nuxt3"]) return "Nuxt";
      if (allDeps["@sveltejs/kit"]) return "SvelteKit";
      if (allDeps["svelte"]) return "Svelte";
      if (allDeps["@remix-run/react"] || allDeps["remix"]) return "Remix";
      if (allDeps["astro"]) return "Astro";
      if (allDeps["vite"]) return "Vite";
      if (allDeps["@angular/core"]) return "Angular";
      if (allDeps["vue"]) return "Vue";
      if (allDeps["react"]) return "React";
      if (allDeps["express"]) return "Express";
      if (allDeps["fastify"]) return "Fastify";
      if (allDeps["hono"]) return "Hono";
      if (allDeps["koa"]) return "Koa";
      if (allDeps["nestjs"] || allDeps["@nestjs/core"]) return "NestJS";
      if (allDeps["gatsby"]) return "Gatsby";
      if (allDeps["webpack-dev-server"]) return "Webpack";
      if (allDeps["esbuild"]) return "esbuild";
      if (allDeps["parcel"]) return "Parcel";
    } catch { }
  }

  if (
    existsSync(join(projectRoot, "vite.config.ts")) ||
    existsSync(join(projectRoot, "vite.config.js"))
  )
    return "Vite";
  if (
    existsSync(join(projectRoot, "next.config.js")) ||
    existsSync(join(projectRoot, "next.config.mjs"))
  )
    return "Next.js";
  if (existsSync(join(projectRoot, "angular.json"))) return "Angular";
  if (existsSync(join(projectRoot, "Cargo.toml"))) return "Rust";
  if (existsSync(join(projectRoot, "go.mod"))) return "Go";
  if (existsSync(join(projectRoot, "manage.py"))) return "Django";
  if (existsSync(join(projectRoot, "Gemfile"))) return "Ruby";

  return null;
}

export function detectFrameworkFromCommand(command, processName) {
  if (!command) return detectFrameworkFromName(processName);
  const cmd = command.toLowerCase();

  if (cmd.includes("next")) return "Next.js";
  if (cmd.includes("vite")) return "Vite";
  if (cmd.includes("nuxt")) return "Nuxt";
  if (cmd.includes("angular") || cmd.includes("ng serve")) return "Angular";
  if (cmd.includes("webpack")) return "Webpack";
  if (cmd.includes("remix")) return "Remix";
  if (cmd.includes("astro")) return "Astro";
  if (cmd.includes("gatsby")) return "Gatsby";
  if (cmd.includes("flask")) return "Flask";
  if (cmd.includes("django") || cmd.includes("manage.py")) return "Django";
  if (cmd.includes("uvicorn")) return "FastAPI";
  if (cmd.includes("rails")) return "Rails";
  if (cmd.includes("cargo") || cmd.includes("rustc")) return "Rust";


  // MLOps / Inference servers
  if (cmd.includes("ollama serve") || cmd.includes("ollama run")) return "Ollama";
  if (cmd.includes("vllm") || cmd.includes("vllm.entrypoints")) return "vLLM";
  if (cmd.includes("tritonserver")) return "Triton Inference Server";
  if (cmd.includes("llama-server") || cmd.includes("llama-cli") || cmd.includes("llama.cpp")) return "llama.cpp";
  if (cmd.includes("lm-studio") || cmd.includes("lmstudio")) return "LM Studio";

  // ML Tooling
  if (cmd.includes("jupyter-lab") || cmd.includes("jupyter-notebook") || cmd.includes("jupyter notebook") || cmd.includes("jupyter lab")) return "Jupyter";
  if (cmd.includes("tensorboard")) return "TensorBoard";
  if (cmd.includes("gradio")) return "Gradio";
  if (cmd.includes("streamlit")) return "Streamlit";
  if (cmd.includes("mlflow")) return "MLflow";

  return detectFrameworkFromName(processName);
}

export function detectFrameworkFromName(processName) {
  const name = (processName || "").toLowerCase();
  if (name === "node") return "Node.js";
  if (name === "python" || name === "python3") return "Python";
  if (name === "ruby") return "Ruby";
  if (name === "java") return "Java";
  if (name === "go") return "Go";

  // MLOps processes
  if (name === "ollama") return "Ollama";
  if (name === "tritonserver") return "Triton Inference Server";
  if (name === "jupyter" || name === "jupyter-lab" || name === "jupyter-notebook") return "Jupyter";
  if (name === "streamlit") return "Streamlit";
  if (name === "mlflow") return "MLflow";
  if (name === "tensorboard") return "TensorBoard";
  if (name === "gradio") return "Gradio";
  if (name === "llama-server" || name === "llama-cli") return "llama.cpp";
  if (name === "vllm") return "vLLM";
  if (name === "lm-studio" || name === "lmstudio") return "LM Studio";
  return null;
}
