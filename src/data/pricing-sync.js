import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CACHE_FILE = join(homedir(), ".portscope", "pricing.json");
const REMOTE_URL = "https://raw.githubusercontent.com/Neilblaze/portscope/main/src/data/llm-pricing.json";

let cachedPricing = null;

export function getSyncedPricing() {
  if (cachedPricing) return cachedPricing;

  let rawData = null;
  let cacheAgeMs = Infinity;

  try {
    if (existsSync(CACHE_FILE)) {
      const stats = statSync(CACHE_FILE);
      cacheAgeMs = Date.now() - stats.mtimeMs;
      rawData = readFileSync(CACHE_FILE, "utf8");
    }
  } catch (err) { }

  if (!rawData) {
    try {
      const bundledPath = new URL("./llm-pricing.json", import.meta.url);
      if (existsSync(bundledPath)) {
        rawData = readFileSync(bundledPath, "utf8");
      }
    } catch (err) { }
  }

  if (rawData) {
    try {
      cachedPricing = JSON.parse(rawData);
    } catch (err) {
      cachedPricing = {};
    }
  } else {
    cachedPricing = {};
  }

  if (cacheAgeMs > 86400000) {  // 24 hrs
    fetch(REMOTE_URL, { signal: AbortSignal.timeout(5000) })
      .then(res => {
        if (res.ok) return res.text();
        throw new Error("HTTP Failed");
      })
      .then(fetchedData => {
        try {
          cachedPricing = JSON.parse(fetchedData);
          const dir = join(homedir(), ".portscope");
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          writeFileSync(CACHE_FILE, fetchedData, "utf8");
        } catch (err) { }
      })
      .catch(() => { });
  }

  return cachedPricing;
}
