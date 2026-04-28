import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

let _version;
try {
  const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8"));
  _version = pkg.version;
} catch {
  _version = "1.4.0";
}

export const VERSION = _version;
