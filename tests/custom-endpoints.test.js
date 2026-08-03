import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REAL_HOME = process.env.HOME;
const REAL_USERPROFILE = process.env.USERPROFILE;
const FAKE_HOME = mkdtempSync(join(tmpdir(), "portscope-test-"));
process.env.HOME = FAKE_HOME;
process.env.USERPROFILE = FAKE_HOME;

const {
  CUSTOM_PREFIX,
  isCustomProvider,
  endpointIdOf,
  slugify,
  envKeyForEndpoint,
  normalizeBaseUrl,
  deriveModelsUrl,
  deriveHealthUrl,
  loadCustomEndpoints,
  saveCustomEndpoints,
  getCustomEndpoint,
  upsertCustomEndpoint,
  removeCustomEndpoint,
  uniqueEndpointId,
  registerCustomEndpoints,
  setEndpointCapability,
} = await import("../src/config/custom-endpoints.js");

const { PROVIDER_DEFAULTS, PROVIDER_IDS, BUILTIN_PROVIDER_IDS } = await import("../src/config/schema.js");

after(() => {
  saveCustomEndpoints([]);
  if (REAL_HOME) process.env.HOME = REAL_HOME; else delete process.env.HOME;
  if (REAL_USERPROFILE) process.env.USERPROFILE = REAL_USERPROFILE; else delete process.env.USERPROFILE;
  rmSync(FAKE_HOME, { recursive: true, force: true });
});

before(() => saveCustomEndpoints([]));


describe("normalizeBaseUrl", () => {
  it("leaves a full chat completions URL alone", () => {
    assert.equal(
      normalizeBaseUrl("https://ai.example.com/v1/chat/completions"),
      "https://ai.example.com/v1/chat/completions",
    );
  });

  it("appends the completions route to an API base", () => {
    assert.equal(
      normalizeBaseUrl("https://ai.example.com/v1"),
      "https://ai.example.com/v1/chat/completions",
    );
  });

  it("assumes the conventional /v1 layout for a bare origin", () => {
    assert.equal(
      normalizeBaseUrl("https://ai.example.com"),
      "https://ai.example.com/v1/chat/completions",
    );
  });

  it("defaults remote hosts to https and local hosts to http", () => {
    assert.equal(normalizeBaseUrl("ai.example.com"), "https://ai.example.com/v1/chat/completions");
    assert.equal(normalizeBaseUrl("localhost:8080"), "http://localhost:8080/v1/chat/completions");
    assert.equal(normalizeBaseUrl("192.168.1.10:1234/v1"), "http://192.168.1.10:1234/v1/chat/completions");
  });

  it("strips trailing slashes", () => {
    assert.equal(
      normalizeBaseUrl("https://ai.example.com/v1/"),
      "https://ai.example.com/v1/chat/completions",
    );
  });

  it("returns null for junk", () => {
    assert.equal(normalizeBaseUrl(""), null);
    assert.equal(normalizeBaseUrl("   "), null);
  });
});


describe("deriveModelsUrl", () => {
  it("swaps the completions route for /models", () => {
    assert.equal(
      deriveModelsUrl("https://ai.example.com/v1/chat/completions"),
      "https://ai.example.com/v1/models",
    );
  });

  it("preserves a query string", () => {
    assert.equal(
      deriveModelsUrl("https://ai.example.com/v1/chat/completions?tenant=acme"),
      "https://ai.example.com/v1/models?tenant=acme",
    );
  });

  it("returns null without a base URL", () => {
    assert.equal(deriveModelsUrl(null), null);
  });
});


describe("deriveHealthUrl", () => {
  it("points at the origin's liveness route, not the API path", () => {
    assert.equal(
      deriveHealthUrl("https://ai.example.com/v1/chat/completions"),
      "https://ai.example.com/healthz",
    );
    assert.equal(
      deriveHealthUrl("http://localhost:8080/v1/chat/completions"),
      "http://localhost:8080/healthz",
    );
  });

  it("returns null for a missing or unparseable base URL", () => {
    assert.equal(deriveHealthUrl(null), null);
    assert.equal(deriveHealthUrl("not a url"), null);
  });
});


describe("provider id helpers", () => {
  it("round-trips a namespaced provider id", () => {
    assert.ok(isCustomProvider(`${CUSTOM_PREFIX}my-api`));
    assert.equal(endpointIdOf(`${CUSTOM_PREFIX}my-api`), "my-api");
  });

  it("does not treat built-ins as custom", () => {
    for (const id of BUILTIN_PROVIDER_IDS) {
      assert.equal(isCustomProvider(id), false, `${id} should not be custom`);
      assert.equal(endpointIdOf(id), null);
    }
  });

  it("slugifies labels into safe ids", () => {
    assert.equal(slugify("Neilblaze AI"), "neilblaze-ai");
    assert.equal(slugify("  ***  "), "endpoint");
    assert.equal(slugify("ai.example.com"), "ai-example-com");
  });

  it("derives an env var name per endpoint", () => {
    assert.equal(envKeyForEndpoint("my-api"), "PORTSCOPE_CUSTOM_MY_API_TOKEN");
  });
});


describe("endpoint persistence", () => {
  it("starts empty", () => {
    assert.deepEqual(loadCustomEndpoints(), []);
  });

  it("upserts, reads back and removes", () => {
    const providerId = upsertCustomEndpoint({
      id: "demo",
      label: "Demo",
      baseUrl: "https://demo.example.com/v1/chat/completions",
      modelsUrl: "https://demo.example.com/v1/models",
      model: null,
      auth: true,
      streaming: false,
      tools: true,
      headers: {},
    });

    assert.equal(providerId, `${CUSTOM_PREFIX}demo`);
    assert.equal(loadCustomEndpoints().length, 1);
    assert.equal(getCustomEndpoint("demo").label, "Demo");

    // Updating an existing id replaces rather than duplicates.
    upsertCustomEndpoint({ id: "demo", label: "Demo v2" });
    assert.equal(loadCustomEndpoints().length, 1);
    assert.equal(getCustomEndpoint("demo").label, "Demo v2");
    assert.equal(getCustomEndpoint("demo").baseUrl, "https://demo.example.com/v1/chat/completions");

    assert.equal(removeCustomEndpoint("demo"), true);
    assert.equal(removeCustomEndpoint("demo"), false);
    assert.deepEqual(loadCustomEndpoints(), []);
  });

  it("hands out non-colliding ids", () => {
    const existing = [{ id: "demo" }, { id: "demo-2" }];
    assert.equal(uniqueEndpointId("Demo", existing), "demo-3");
    assert.equal(uniqueEndpointId("Other", existing), "other");
  });

  it("persists a learned capability downgrade", () => {
    upsertCustomEndpoint({
      id: "downgrade",
      label: "Downgrade",
      baseUrl: "https://d.example.com/v1/chat/completions",
      auth: false,
      streaming: true,
      tools: true,
    });

    setEndpointCapability(`${CUSTOM_PREFIX}downgrade`, { tools: false, streaming: false });

    const ep = getCustomEndpoint("downgrade");
    assert.equal(ep.tools, false);
    assert.equal(ep.streaming, false);
    assert.equal(ep.label, "Downgrade", "unrelated fields survive");

    removeCustomEndpoint("downgrade");
  });
});


describe("registerCustomEndpoints", () => {
  it("merges endpoints into the live provider registry", () => {
    upsertCustomEndpoint({
      id: "reg",
      label: "Registered",
      baseUrl: "https://reg.example.com/v1/chat/completions",
      modelsUrl: "https://reg.example.com/v1/models",
      model: "some-model",
      auth: true,
      streaming: true,
      tools: false,
      headers: { "X-Tenant": "acme" },
    });

    const providerId = `${CUSTOM_PREFIX}reg`;
    assert.ok(PROVIDER_IDS.includes(providerId));

    const d = PROVIDER_DEFAULTS[providerId];
    assert.equal(d.label, "Registered");
    assert.equal(d.baseUrl, "https://reg.example.com/v1/chat/completions");
    assert.equal(d.model, "some-model");
    assert.equal(d.envKey, "PORTSCOPE_CUSTOM_REG_TOKEN");
    assert.equal(d.isCustom, true);
    assert.equal(d.streaming, true);
    assert.equal(d.supportsTools, false);
    assert.deepEqual(d.extraHeaders, { "X-Tenant": "acme" });
  });

  it("gives token-less endpoints no envKey", () => {
    upsertCustomEndpoint({
      id: "noauth",
      label: "No Auth",
      baseUrl: "https://na.example.com/v1/chat/completions",
      auth: false,
    });
    assert.equal(PROVIDER_DEFAULTS[`${CUSTOM_PREFIX}noauth`].envKey, null);
  });

  it("defaults to non-streaming when unspecified", () => {
    upsertCustomEndpoint({
      id: "plain",
      label: "Plain",
      baseUrl: "https://p.example.com/v1/chat/completions",
    });
    const d = PROVIDER_DEFAULTS[`${CUSTOM_PREFIX}plain`];
    assert.equal(d.streaming, false);
    assert.equal(d.supportsTools, true);
  });

  it("is idempotent and drops removed endpoints", () => {
    const before = PROVIDER_IDS.length;
    registerCustomEndpoints();
    assert.equal(PROVIDER_IDS.length, before);

    saveCustomEndpoints([]);
    assert.deepEqual(PROVIDER_IDS, [...BUILTIN_PROVIDER_IDS]);
    assert.equal(PROVIDER_DEFAULTS[`${CUSTOM_PREFIX}reg`], undefined);
  });

  it("never clobbers a built-in provider", () => {
    saveCustomEndpoints([
      { id: "openai", label: "Impostor", baseUrl: "https://evil.example.com/v1/chat/completions" },
    ]);
    // `custom:openai` is namespaced, so the real OpenAI entry is untouched.
    assert.equal(PROVIDER_DEFAULTS.openai.baseUrl, "https://api.openai.com/v1/chat/completions");
    assert.equal(PROVIDER_DEFAULTS[`${CUSTOM_PREFIX}openai`].label, "Impostor");
    saveCustomEndpoints([]);
  });

  it("ignores malformed entries", () => {
    saveCustomEndpoints([
      { id: "ok", label: "Ok", baseUrl: "https://ok.example.com/v1/chat/completions" },
      { label: "no id", baseUrl: "https://x.example.com" },
      { id: "no-url" },
      null,
    ]);
    const ids = loadCustomEndpoints().map((e) => e.id);
    assert.deepEqual(ids, ["ok"]);
    saveCustomEndpoints([]);
  });
});
