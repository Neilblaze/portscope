import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { PROVIDER_DEFAULTS, PROVIDER_IDS, BUILTIN_PROVIDER_IDS } from "./schema.js";

const PORTSCOPE_HOME = join(homedir(), ".portscope");
const ENDPOINTS_FILE = join(PORTSCOPE_HOME, "endpoints.json");

export const CUSTOM_PREFIX = "custom:";

export function isCustomProvider(providerId) {
  return typeof providerId === "string" && providerId.startsWith(CUSTOM_PREFIX);
}

// `custom:my-api` → `my-api`
export function endpointIdOf(providerId) {
  return isCustomProvider(providerId) ? providerId.slice(CUSTOM_PREFIX.length) : null;
}

export function slugify(name) {
  const slug = String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return slug || "endpoint";
}

export function envKeyForEndpoint(endpointId) {
  return `PORTSCOPE_CUSTOM_${String(endpointId).toUpperCase().replace(/[^A-Z0-9]/g, "_")}_TOKEN`;
}


/**
 * Normalize whatever the user pasted into a POST-able chat completions URL.
 *   https://host                     → https://host/v1/chat/completions
 *   https://host/v1                  → https://host/v1/chat/completions
 *   https://host/v1/chat/completions → unchanged
 * Returns null if the input can't be parsed as a URL.
 */
export function normalizeBaseUrl(input) {
  let raw = String(input || "").trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) {
    // Local/private hosts almost never speak TLS; everything else defaults to https.
    const isLocal = /^(localhost|127\.|0\.0\.0\.0|\[?::1\]?|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(raw);
    raw = (isLocal ? "http://" : "https://") + raw;
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  let path = url.pathname.replace(/\/+$/, "");

  if (/\/(chat\/)?completions$/i.test(path) || /\/responses$/i.test(path)) {
    return `${url.origin}${path}${url.search}`;
  }

  if (!path) path = "/v1";

  return `${url.origin}${path}/chat/completions${url.search}`;
}


export function deriveHealthUrl(baseUrl) {
  if (!baseUrl) return null;
  try {
    return `${new URL(baseUrl).origin}/healthz`;
  } catch {
    return null;
  }
}

export function deriveModelsUrl(baseUrl) {
  if (!baseUrl) return null;
  const [path, query = ""] = String(baseUrl).split("?");
  const suffix = query ? `?${query}` : "";
  if (/\/chat\/completions$/i.test(path)) {
    return path.replace(/\/chat\/completions$/i, "/models") + suffix;
  }
  if (/\/completions$/i.test(path)) {
    return path.replace(/\/completions$/i, "/models") + suffix;
  }
  return path.replace(/\/[^/]*$/, "/models") + suffix;
}


export function loadCustomEndpoints() {
  if (!existsSync(ENDPOINTS_FILE)) return [];
  try {
    const raw = JSON.parse(readFileSync(ENDPOINTS_FILE, "utf8"));
    const list = Array.isArray(raw) ? raw : raw?.endpoints;
    if (!Array.isArray(list)) return [];
    return list.filter(
      (e) => e && typeof e.id === "string" && e.id && typeof e.baseUrl === "string" && e.baseUrl,
    );
  } catch {
    return [];
  }
}

export function saveCustomEndpoints(endpoints) {
  if (!existsSync(PORTSCOPE_HOME)) {
    mkdirSync(PORTSCOPE_HOME, { recursive: true, mode: 0o700 });
  }
  const payload = { version: 1, endpoints };
  writeFileSync(ENDPOINTS_FILE, JSON.stringify(payload, null, 2) + "\n", {
    encoding: "utf8",
    mode: 0o600,
  });
  try { chmodSync(ENDPOINTS_FILE, 0o600); } catch { }
  registerCustomEndpoints();
}

export function getCustomEndpoint(endpointId) {
  return loadCustomEndpoints().find((e) => e.id === endpointId) || null;
}

/**
 * Insert or replace an endpoint definition, then re-register providers.
 * @returns {string} the provider id (`custom:<id>`)
 */
export function upsertCustomEndpoint(endpoint) {
  const endpoints = loadCustomEndpoints();
  const idx = endpoints.findIndex((e) => e.id === endpoint.id);
  if (idx === -1) endpoints.push(endpoint);
  else endpoints[idx] = { ...endpoints[idx], ...endpoint };
  saveCustomEndpoints(endpoints);
  return CUSTOM_PREFIX + endpoint.id;
}

export function removeCustomEndpoint(endpointId) {
  const endpoints = loadCustomEndpoints();
  const next = endpoints.filter((e) => e.id !== endpointId);
  if (next.length === endpoints.length) return false;
  saveCustomEndpoints(next);
  return true;
}

export function setEndpointCapability(providerId, patch) {
  const endpointId = endpointIdOf(providerId);
  if (!endpointId) return;
  const existing = getCustomEndpoint(endpointId);
  if (!existing) return;
  upsertCustomEndpoint({ ...existing, ...patch });
}

export function uniqueEndpointId(label, existing = loadCustomEndpoints()) {
  const base = slugify(label);
  const taken = new Set(existing.map((e) => e.id));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}


/**
 * Merge saved endpoints into PROVIDER_DEFAULTS / PROVIDER_IDS so every existing
 * `PROVIDER_DEFAULTS[provider]` lookup keeps working unchanged.
 * Idempotent — safe to call on every config (re)load.
 */
export function registerCustomEndpoints() {
  for (const id of [...PROVIDER_IDS]) {
    if (isCustomProvider(id)) {
      PROVIDER_IDS.splice(PROVIDER_IDS.indexOf(id), 1);
      delete PROVIDER_DEFAULTS[id];
    }
  }

  const endpoints = loadCustomEndpoints();
  for (const ep of endpoints) {
    const providerId = CUSTOM_PREFIX + ep.id;
    if (BUILTIN_PROVIDER_IDS.includes(providerId)) continue;

    PROVIDER_DEFAULTS[providerId] = {
      model: ep.model || null,
      envKey: ep.auth === false ? null : envKeyForEndpoint(ep.id),
      baseUrl: ep.baseUrl,
      modelsUrl: ep.modelsUrl || null,
      label: ep.label || ep.id,
      isCustom: true,
      endpointId: ep.id,
      streaming: ep.streaming === true,
      supportsTools: ep.tools !== false,
      extraHeaders: ep.headers && typeof ep.headers === "object" ? ep.headers : {},
    };
    PROVIDER_IDS.push(providerId);
  }

  return endpoints;
}
