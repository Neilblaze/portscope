/**
 * Input sanitization for shell-interpolated values.
 * Prevents command injection when values are used in execSync() calls.
 */


// Validate that a value is a safe positive integer (PIDs, port numbers)
export function assertSafeInt(val) {
  const n = Number(val);
  if (!Number.isInteger(n) || n < 0 || n > 4294967295) {
    throw new Error(`Invalid numeric argument: ${val}`);
  }
  return n;
}


// Reject file paths containing shell metacharacters
export function sanitizePath(p) {
  if (typeof p !== "string" || !p) {
    throw new Error("Invalid path: empty or non-string");
  }
  if (/[;&|`$(){}!\n\r\0]/.test(p)) {
    throw new Error(`Unsafe characters in path: ${p}`);
  }
  return p;
}
