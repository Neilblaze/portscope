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
