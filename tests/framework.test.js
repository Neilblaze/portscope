import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectFramework,
  detectFrameworkFromCommand,
  detectFrameworkFromImage,
  detectFrameworkFromName,
} from "../src/scanner/framework.js";

// ── detectFrameworkFromCommand ─────────────────────────────────────── //

describe("detectFrameworkFromCommand", () => {
  const cases = [
    // Web frameworks
    ["node /app/.next/standalone/server.js", null, "Next.js"],
    ["npx vite --port 3000", null, "Vite"],
    ["npx nuxt dev", null, "Nuxt"],
    ["ng serve", null, "Angular"],
    ["python -m flask run", null, "Flask"],
    ["python manage.py runserver", null, "Django"],
    ["uvicorn main:app --reload", null, "FastAPI"],
    ["bin/rails server", null, "Rails"],
    ["cargo run --bin server", null, "Rust"],
    // MLOps / Inference servers
    ["ollama serve", null, "Ollama"],
    ["ollama run llama3", null, "Ollama"],
    ["python -m vllm.entrypoints.openai.api_server", null, "vLLM"],
    ["tritonserver --model-repository=/models", null, "Triton Inference Server"],
    ["llama-server --model ggml-model.bin", null, "llama.cpp"],
    ["llama-cli -m model.gguf", null, "llama.cpp"],
    ["/path/to/llama.cpp/server", null, "llama.cpp"],
    ["lm-studio serve", null, "LM Studio"],
    ["lmstudio server", null, "LM Studio"],
    // ML Tooling
    ["jupyter-lab --port 8888", null, "Jupyter"],
    ["jupyter-notebook", null, "Jupyter"],
    ["jupyter notebook --ip=0.0.0.0", null, "Jupyter"],
    ["jupyter lab", null, "Jupyter"],
    ["tensorboard --logdir=runs", null, "TensorBoard"],
    ["python -m gradio app.py", null, "Gradio"],
    ["streamlit run app.py", null, "Streamlit"],
    ["mlflow server --host 0.0.0.0", null, "MLflow"],
  ];

  for (const [cmd, procName, expected] of cases) {
    it(`"${cmd}" → ${expected}`, () => {
      assert.equal(detectFrameworkFromCommand(cmd, procName), expected);
    });
  }

  it("falls back to processName detection when command has no match", () => {
    assert.equal(detectFrameworkFromCommand("/usr/bin/unknown", "node"), "Node.js");
    assert.equal(detectFrameworkFromCommand("/usr/bin/unknown", "python3"), "Python");
  });

  it("returns null for unknown command and process", () => {
    assert.equal(detectFrameworkFromCommand("/usr/bin/unknown", "unknown"), null);
  });
});


// ── detectFrameworkFromImage ──────────────────────────────────────── //

describe("detectFrameworkFromImage", () => {
  const cases = [
    [null, "Docker"],
    ["postgres:15", "PostgreSQL"],
    ["redis:7-alpine", "Redis"],
    ["mysql:8", "MySQL"],
    ["mariadb:10", "MySQL"],
    ["mongo:6", "MongoDB"],
    ["nginx:latest", "nginx"],
    ["localstack/localstack", "LocalStack"],
    ["rabbitmq:3-management", "RabbitMQ"],
    ["confluentinc/cp-kafka:7.5", "Kafka"],
    ["elasticsearch:8.11", "Elasticsearch"],
    ["opensearchproject/opensearch", "Elasticsearch"],
    ["minio/minio", "MinIO"],
    // MLOps / Inference
    ["vllm/vllm-openai:latest", "vLLM"],
    ["nvcr.io/nvidia/tritonserver:23.10-py3", "Triton Inference Server"],
    ["ollama/ollama:latest", "Ollama"],
    ["jupyter/minimal-notebook:latest", "Jupyter"],
    ["tensorflow/tensorflow:latest-gpu-tensorboard", "TensorBoard"],
    ["mlflow/mlflow:2.8", "MLflow"],
    ["streamlit/streamlit:latest", "Streamlit"],
    ["gradio/gradio:latest", "Gradio"],
    // Unknown image
    ["my-custom-app:v2", "Docker"],
  ];

  for (const [image, expected] of cases) {
    it(`"${image}" → ${expected}`, () => {
      assert.equal(detectFrameworkFromImage(image), expected);
    });
  }
});


// ── detectFrameworkFromName ───────────────────────────────────────── //

describe("detectFrameworkFromName", () => {
  const cases = [
    ["node", "Node.js"],
    ["python", "Python"],
    ["python3", "Python"],
    ["ruby", "Ruby"],
    ["java", "Java"],
    ["go", "Go"],
    // MLOps
    ["ollama", "Ollama"],
    ["tritonserver", "Triton Inference Server"],
    ["jupyter", "Jupyter"],
    ["jupyter-lab", "Jupyter"],
    ["jupyter-notebook", "Jupyter"],
    ["streamlit", "Streamlit"],
    ["mlflow", "MLflow"],
    ["tensorboard", "TensorBoard"],
    ["gradio", "Gradio"],
    ["llama-server", "llama.cpp"],
    ["llama-cli", "llama.cpp"],
    ["vllm", "vLLM"],
    ["lm-studio", "LM Studio"],
    ["lmstudio", "LM Studio"],
    // Unknown
    ["unknown", null],
    ["", null],
    [null, null],
  ];

  for (const [name, expected] of cases) {
    it(`"${name}" → ${expected}`, () => {
      assert.equal(detectFrameworkFromName(name), expected);
    });
  }
});


// ── detectFramework (project-root heuristic) ─────────────────────── //

describe("detectFramework", () => {
  it("returns null for a nonexistent directory", () => {
    assert.equal(detectFramework("/tmp/__portscope_nonexistent__"), null);
  });
});
