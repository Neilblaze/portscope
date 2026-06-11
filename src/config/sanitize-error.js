import chalk from "chalk";

/**
 * Sanitize error messages to prevent leaking sensitive data like API keys.
 * 
 * This function removes:
 * - API keys (sk-*, api_*, key_*, etc.)
 * - Bearer tokens
 * - Authorization headers
 * - Base64 encoded credentials
 * - Long alphanumeric strings that might be secrets
 * 
 * @param {Error|string} err - Error object or error message string
 * @returns {string} - Sanitized error message safe for display
 */


export function sanitizeError(err) {
  let msg = err?.message || String(err);

  msg = msg.replace(/Authorization:\s+Bearer\s+[a-zA-Z0-9_\-\.=]{20,}/gi, 'Authorization: Bearer [REDACTED_TOKEN]');
  msg = msg.replace(/(?<!Authorization:\s)Bearer\s+[a-zA-Z0-9_\-\.=]{20,}/gi, 'Bearer [REDACTED_TOKEN]');
  msg = msg.replace(/Authorization:\s+(?!Bearer\s+\[REDACTED_TOKEN\])[^\s,]+/gi, 'Authorization: [REDACTED]');
  msg = msg.replace(/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, '[REDACTED_JWT]');

  // Remove common API key patterns
  // Matches: sk-*, api_*, key_*, apikey_*, secret_* followed by 20+ alphanumeric chars
  msg = msg.replace(/\b(sk-|api_|key_|apikey_|secret_)[a-zA-Z0-9_-]{20,}\b/gi, '[REDACTED_KEY]');

  // Remove x-api-key header values
  msg = msg.replace(/(x-api-key|anthropic-api-key):\s*[^\s,]+/gi, '$1: [REDACTED]');

  // Remove long hex strings BEFORE base64 (32+ chars, only hex digits)
  msg = msg.replace(/\b[a-fA-F0-9]{32,}\b/g, '[REDACTED_HEX]');

  // Remove base64 encoded strings that might be credentials (40+ chars)
  msg = msg.replace(/\b[A-Za-z0-9+/]{40,}={0,2}\b/g, '[REDACTED_BASE64]');

  return msg;
}


/**
 * Sanitize an entire error object, including nested properties.
 * Useful for logging error objects that might contain sensitive data.
 * 
 * @param {Error} err - Error object to sanitize
 * @returns {object} - Sanitized error object safe for logging
 */
export function sanitizeErrorObject(err) {
  if (!err) return null;

  const sanitized = {
    message: sanitizeError(err.message),
    name: err.name,
    code: err.code,
  };

  if (err.stack) {
    sanitized.stack = sanitizeError(err.stack);
  }

  if (err.cause) {
    sanitized.cause = sanitizeErrorObject(err.cause);
  }

  return sanitized;
}


export function formatChatError(err) {
  const sanitized = sanitizeError(err);
  const l = sanitized.toLowerCase();

  if (l.includes("does not exist") || l.includes("not found") || l.includes("not exist")) {
    return `\n  ${chalk.red.bold("🚫 Invalid Model")} ${chalk.gray("·")} ${chalk.redBright(sanitized)}\n`;
  }
  if ((l.includes("invalid ") && l.includes("key")) || l.includes("incorrect api key")) {
    return `\n  ${chalk.red.bold("🔑 Auth Failed")} ${chalk.gray("·")} ${chalk.redBright(sanitized)}\n`;
  }
  if (l.includes("temporarily unavailable") || l.includes("502") || l.includes("503") || l.includes("overloaded")) {
    return `\n  ${chalk.yellow.bold("📡 Provider Down")} ${chalk.gray("·")} ${chalk.yellowBright(sanitized)}\n`;
  }
  if (l.includes("timed out") || l.includes("timeout")) {
    return `\n  ${chalk.yellow.bold("⏳ Timeout")} ${chalk.gray("·")} ${chalk.yellowBright(sanitized)}\n`;
  }
  if (l.includes("cannot connect to ollama") || l.includes("econnrefused")) {
    return `\n  ${chalk.red.bold("🔌 Offline")} ${chalk.gray("·")} ${chalk.redBright(sanitized)}\n`;
  }
  if (l.includes("rate limit") || l.includes("429") || l.includes("quota") || l.includes("insufficient_quota")) {
    return `\n  ${chalk.red.bold("🛑 Rate Limited")} ${chalk.gray("·")} ${chalk.redBright(sanitized)}\n`;
  }

  return `\n  ${chalk.red.bold("⚠️  API Error")} ${chalk.gray("·")} ${chalk.redBright(sanitized)}\n`;
}
