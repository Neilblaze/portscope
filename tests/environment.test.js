import { describe, it } from "node:test";
import assert from "node:assert";
import { detectEnvironment } from "../src/scanner/environment.js";

describe("detectEnvironment", () => {
  it("detects development from npm run dev", () => {
    const env = detectEnvironment(12345, "npm run dev", "node");
    assert.strictEqual(env, "development");
  });

  it("detects development from yarn dev", () => {
    const env = detectEnvironment(12345, "yarn dev", "node");
    assert.strictEqual(env, "development");
  });

  it("detects production from npm start", () => {
    const env = detectEnvironment(12345, "npm start", "node");
    assert.strictEqual(env, "production");
  });

  it("detects production from npm run build", () => {
    const env = detectEnvironment(12345, "npm run build", "node");
    assert.strictEqual(env, "production");
  });

  it("detects development from next dev", () => {
    const env = detectEnvironment(12345, "next dev", "node");
    assert.strictEqual(env, "development");
  });

  it("detects production from next start", () => {
    const env = detectEnvironment(12345, "next start", "node");
    assert.strictEqual(env, "production");
  });

  it("detects production from next build", () => {
    const env = detectEnvironment(12345, "next build", "node");
    assert.strictEqual(env, "production");
  });

  it("detects development from vite dev", () => {
    const env = detectEnvironment(12345, "vite dev", "node");
    assert.strictEqual(env, "development");
  });

  it("detects production from vite build", () => {
    const env = detectEnvironment(12345, "vite build", "node");
    assert.strictEqual(env, "production");
  });

  it("detects development from nodemon", () => {
    const env = detectEnvironment(12345, "nodemon server.js", "nodemon");
    assert.strictEqual(env, "development");
  });

  it("detects production from pm2", () => {
    const env = detectEnvironment(12345, "pm2 start app.js", "pm2");
    assert.strictEqual(env, "production");
  });

  it("detects development from Django runserver", () => {
    const env = detectEnvironment(12345, "python manage.py runserver", "python");
    assert.strictEqual(env, "development");
  });

  it("detects production from gunicorn", () => {
    const env = detectEnvironment(12345, "gunicorn app:app", "python");
    assert.strictEqual(env, "production");
  });

  it("detects development from uvicorn with reload", () => {
    const env = detectEnvironment(12345, "uvicorn main:app --reload", "python");
    assert.strictEqual(env, "development");
  });

  it("detects development from flask run", () => {
    const env = detectEnvironment(12345, "flask run", "python");
    assert.strictEqual(env, "development");
  });

  it("detects development from rails server", () => {
    const env = detectEnvironment(12345, "rails server", "ruby");
    assert.strictEqual(env, "development");
  });

  it("detects development from webpack-dev-server", () => {
    const env = detectEnvironment(12345, "webpack-dev-server --hot", "node");
    assert.strictEqual(env, "development");
  });

  it("detects test from jest", () => {
    const env = detectEnvironment(12345, "jest --watch", "node");
    assert.strictEqual(env, "test");
  });

  it("detects test from vitest", () => {
    const env = detectEnvironment(12345, "vitest run", "node");
    assert.strictEqual(env, "test");
  });

  it("detects test from pytest", () => {
    const env = detectEnvironment(12345, "pytest tests/", "python");
    assert.strictEqual(env, "test");
  });

  it("detects production from --env=production flag", () => {
    const env = detectEnvironment(12345, "node server.js --env=production", "node");
    assert.strictEqual(env, "production");
  });

  it("detects development from --env=development flag", () => {
    const env = detectEnvironment(12345, "node server.js --env=development", "node");
    assert.strictEqual(env, "development");
  });

  it("detects production from --mode=production flag", () => {
    const env = detectEnvironment(12345, "vite --mode=production", "node");
    assert.strictEqual(env, "production");
  });

  it("detects production from --production flag", () => {
    const env = detectEnvironment(12345, "node server.js --production", "node");
    assert.strictEqual(env, "production");
  });

  it("detects development from --dev flag", () => {
    const env = detectEnvironment(12345, "node server.js --dev", "node");
    assert.strictEqual(env, "development");
  });

  it("returns null for unknown commands", () => {
    const env = detectEnvironment(12345, "unknown-command", "unknown");
    assert.strictEqual(env, null);
  });

  it("returns null for empty command", () => {
    const env = detectEnvironment(12345, "", "node");
    assert.strictEqual(env, null);
  });

  it("returns null for system processes", () => {
    const env = detectEnvironment(12345, "/usr/sbin/systemd", "systemd");
    assert.strictEqual(env, null);
  });

  it("handles case-insensitive matching", () => {
    const env = detectEnvironment(12345, "NPM RUN DEV", "node");
    assert.strictEqual(env, "development");
  });

  it("detects test from npm run test", () => {
    const env = detectEnvironment(12345, "npm run test", "node");
    assert.strictEqual(env, "test");
  });

  it("detects staging from --env=staging flag", () => {
    const env = detectEnvironment(12345, "node server.js --env=staging", "node");
    assert.strictEqual(env, "staging");
  });
});
