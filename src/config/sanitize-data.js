/**
 * Scrubs sensitive patterns from tool results BEFORE they are sent to the AI
 * provider. The sanitizer is conservative — it only redacts high-confidence
 * secret patterns, preserving diagnostic value (error messages, stack traces,
 * port numbers, process names).
 *
 * Handles:
 *   - API keys / tokens (sk-*, api_*, key_*, Bearer, JWT)
 *   - Database / service connection strings (postgres://, mongodb://, redis://, etc.)
 *   - Environment variable values for sensitive var names (*_KEY, *_SECRET, etc.)
 *   - Private key blocks (PEM)
 *   - AWS-style credentials
 *   - User-configurable custom patterns
 */


const SENSITIVE_VAR_NAMES = new Set([
  "PASSWORD", "PASSWD", "PASS",
  "SECRET", "SECRET_KEY",
  "TOKEN", "ACCESS_TOKEN", "REFRESH_TOKEN", "AUTH_TOKEN",
  "API_KEY", "APIKEY",
  "PRIVATE_KEY",
  "DATABASE_URL", "DB_URL", "DB_PASSWORD", "DB_PASS",
  "REDIS_URL", "REDIS_PASSWORD",
  "MONGO_URI", "MONGODB_URI", "MONGO_URL",
  "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN",
  "STRIPE_SECRET_KEY", "STRIPE_KEY",
  "SENDGRID_API_KEY",
  "TWILIO_AUTH_TOKEN",
  "GITHUB_TOKEN", "GH_TOKEN", "GITLAB_TOKEN",
  "SLACK_TOKEN", "SLACK_WEBHOOK",
  "ENCRYPTION_KEY", "SIGNING_KEY",
  "JWT_SECRET", "SESSION_SECRET",
  "COOKIE_SECRET",
  "DSN", "SENTRY_DSN",
]);

function isSensitiveVarName(name) {
  const upper = name.toUpperCase();
  if (SENSITIVE_VAR_NAMES.has(upper)) return true;

  const suffixes = [
    "_KEY", "_SECRET", "_TOKEN", "_PASSWORD", "_PASSWD",
    "_CREDENTIAL", "_CREDENTIALS", "_DSN", "_AUTH",
  ];
  return suffixes.some((s) => upper.endsWith(s));
}


export function sanitizeText(text, customPatterns = []) {
  if (!text || typeof text !== "string") return text;
  let result = text;

  // 1. API key patterns (same as sanitize-error.js, kept in sync)
  result = result.replace(/\b(sk-|api_|key_|apikey_|secret_)[a-zA-Z0-9_-]{20,}\b/gi, "[REDACTED_KEY]");

  // 2. Bearer tokens
  result = result.replace(/Bearer\s+[a-zA-Z0-9_\-.=]{20,}/gi, "Bearer [REDACTED_TOKEN]");

  // 3. JWT tokens
  result = result.replace(/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, "[REDACTED_JWT]");

  // 4. Connection strings with credentials
  result = result.replace(
    /\b(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|rediss|amqp|amqps|mssql|sqlite):\/\/[^\s"'`,;)}\]]+/gi,
    (match) => {
      // Redact the credentials portion: protocol://user:pass@host → protocol://[REDACTED]@host
      return match.replace(/:\/\/([^@]+)@/, "://[REDACTED]@");
    },
  );

  // 5. Inline env var assignments with sensitive names
  //    Matches: VAR_NAME=value or VAR_NAME="value" in log lines
  result = result.replace(
    /\b([A-Z][A-Z0-9_]{2,})=("[^"]*"|'[^']*'|[^\s,;]+)/g,
    (match, name, value) => {
      if (isSensitiveVarName(name)) {
        return `${name}=[REDACTED]`;
      }
      return match;
    },
  );

  // 6. PEM private key blocks
  result = result.replace(
    /-----BEGIN\s[A-Z\s]*PRIVATE\s*KEY-----[\s\S]*?-----END\s[A-Z\s]*PRIVATE\s*KEY-----/g,
    "[REDACTED_PRIVATE_KEY]",
  );

  // 7. AWS-style access key IDs (AKIA...)
  result = result.replace(/\bAKIA[A-Z0-9]{16}\b/g, "[REDACTED_AWS_KEY]");

  // 8. Long hex strings (32+ chars) that look like secrets / hashes
  result = result.replace(/\b[a-fA-F0-9]{40,}\b/g, "[REDACTED_HEX]");

  // 9. User-configurable custom patterns
  for (const pattern of customPatterns) {
    try {
      const re = pattern instanceof RegExp ? pattern : new RegExp(pattern, "gi");
      result = result.replace(re, "[REDACTED_CUSTOM]");
    } catch {
      // Skip invalid patterns silently
    }
  }

  return result;
}


/**
 * Recursively sanitize an object (tool result) for AI transmission.
 * Walks through all string values and applies sanitizeText().
 *
 * @param {*} data — tool result (object, array, or primitive)
 * @param {RegExp[]} [customPatterns] — additional user-defined patterns
 * @returns {*} — sanitized copy (original not mutated)
 */
export function sanitizeForAI(data, customPatterns = []) {
  if (data === null || data === undefined) return data;

  if (typeof data === "string") {
    return sanitizeText(data, customPatterns);
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForAI(item, customPatterns));
  }

  if (typeof data === "object") {
    const out = {};
    for (const [key, value] of Object.entries(data)) {
      out[key] = sanitizeForAI(value, customPatterns);
    }
    return out;
  }
  return data;
}
