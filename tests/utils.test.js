import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isDevProcess,
  formatUptime,
  formatMemory,
  summarizeCommand,
} from "../src/scanner/utils.js";

// ── isDevProcess ─────────────────────────────────────────────────── //

describe("isDevProcess", () => {
  it("recognizes standard dev process names", () => {
    const devNames = ["node", "python", "python3", "ruby", "java", "go", "deno", "bun", "uvicorn", "flask"];
    for (const name of devNames) {
      assert.equal(isDevProcess(name, ""), true, `${name} should be a dev process`);
    }
  });

  it("recognizes MLOps process names", () => {
    const mlNames = [
      "ollama", "tritonserver", "vllm", "llama-server", "llama-cli",
      "jupyter", "jupyter-lab", "jupyter-notebook",
      "tensorboard", "streamlit", "mlflow", "gradio",
    ];
    for (const name of mlNames) {
      assert.equal(isDevProcess(name, ""), true, `${name} should be a dev process`);
    }
  });

  it("rejects system/desktop app process names", () => {
    const systemNames = ["spotify", "chrome", "slack", "discord", "figma", "systemd"];
    for (const name of systemNames) {
      assert.equal(isDevProcess(name, ""), false, `${name} should NOT be a dev process`);
    }
  });

  it("matches dev commands even with unknown process name", () => {
    assert.equal(isDevProcess("unknown", "node /app/server.js"), true);
    assert.equal(isDevProcess("unknown", "uvicorn main:app"), true);
    assert.equal(isDevProcess("unknown", "ollama serve"), true);
    assert.equal(isDevProcess("unknown", "jupyter-lab --port 8888"), true);
    assert.equal(isDevProcess("unknown", "tensorboard --logdir=runs"), true);
    assert.equal(isDevProcess("unknown", "streamlit run app.py"), true);
    assert.equal(isDevProcess("unknown", "mlflow server"), true);
    assert.equal(isDevProcess("unknown", "vllm serve"), true);
  });

  it("recognizes Docker processes", () => {
    assert.equal(isDevProcess("com.docker.backend", ""), true);
    assert.equal(isDevProcess("docker", ""), true);
    assert.equal(isDevProcess("docker-sandbox", ""), true);
  });

  it("returns false for empty/null input", () => {
    assert.equal(isDevProcess("", ""), false);
    assert.equal(isDevProcess(null, null), false);
  });
});


// ── formatUptime ─────────────────────────────────────────────────── //

describe("formatUptime", () => {
  it("formats seconds", () => {
    assert.equal(formatUptime(5000), "5s");
    assert.equal(formatUptime(59000), "59s");
  });

  it("formats minutes and seconds", () => {
    assert.equal(formatUptime(90000), "1m 30s");
    assert.equal(formatUptime(300000), "5m 0s");
  });

  it("formats hours and minutes", () => {
    assert.equal(formatUptime(3660000), "1h 1m");
  });

  it("formats days and hours", () => {
    assert.equal(formatUptime(90000000), "1d 1h");
  });

  it("handles zero", () => {
    assert.equal(formatUptime(0), "0s");
  });
});


// ── formatMemory ─────────────────────────────────────────────────── //

describe("formatMemory", () => {
  it("formats KB", () => {
    assert.equal(formatMemory(512), "512 KB");
  });

  it("formats MB", () => {
    assert.equal(formatMemory(2048), "2.0 MB");
  });

  it("formats GB", () => {
    assert.equal(formatMemory(2097152), "2.0 GB");
  });
});


// ── summarizeCommand ─────────────────────────────────────────────── //

describe("summarizeCommand", () => {
  it("extracts meaningful parts from a command", () => {
    const result = summarizeCommand("node /app/server.js --port 3000", "node");
    assert.equal(result, "server.js 3000");
  });

  it("returns process name when command is empty", () => {
    assert.equal(summarizeCommand("", "node"), "node");
    assert.equal(summarizeCommand(null, "python"), "python");
  });

  it("strips paths to basenames", () => {
    const result = summarizeCommand("python /home/user/project/main.py", "python");
    assert.equal(result, "main.py");
  });
});
