// Platform abstraction — lazy-loads the correct OS module.


let _platformPromise = null;

export function getPlatform() {
  if (!_platformPromise) {
    const name = process.platform;
    if (name === "darwin") {
      _platformPromise = import("./darwin.js");
    } else if (name === "linux") {
      _platformPromise = import("./linux.js");
    } else if (name === "win32") {
      _platformPromise = import("./win32.js");
    } else {
      _platformPromise = Promise.reject(
        new Error(`Unsupported platform: ${name}`),
      );
    }
  }
  return _platformPromise;
}
