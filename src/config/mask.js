// Mask an API key for display, showing only the first 5 and last 4 characters

export function maskApiKey(key) {
  if (!key || typeof key !== "string") return "";
  
  if (key === "local") return key;
  
  if (key.length <= 15) {
    if (key.length <= 5) return "*".repeat(key.length);
    return key.slice(0, 3) + "*".repeat(key.length - 5) + key.slice(-2);
  }
  
  const visibleStart = key.slice(0, 5);
  const visibleEnd = key.slice(-4);
  const maskedLength = key.length - 9;
  
  return visibleStart + "*".repeat(maskedLength) + visibleEnd;
}
