/**
 * Environment detection for running processes.
 * Detects development, production, test, and staging environments
 * from environment variables, command-line flags, and process patterns.
 */

import { execSync } from "child_process";
import { platform } from "os";

export function detectEnvironment(pid, command, processName) {
  if (!pid || !command) return null;

  const envVars = getProcessEnvVars(pid);
  
  const envFromVars = detectFromEnvVars(envVars);
  if (envFromVars) return envFromVars;

  const envFromCommand = detectFromCommand(command);
  if (envFromCommand) return envFromCommand;

  const envFromProcess = detectFromProcessName(processName, command);
  if (envFromProcess) return envFromProcess;

  return null;
}

function getProcessEnvVars(pid) {
  const envMap = new Map();
  
  try {
    let envOutput = "";
    
    if (platform() === "linux") {
      try {
        envOutput = execSync(`cat /proc/${pid}/environ 2>/dev/null`, {
          encoding: "utf8",
          timeout: 1000,
          maxBuffer: 1024 * 1024,
        });
        const entries = envOutput.split("\0").filter(Boolean);
        for (const entry of entries) {
          const eqIdx = entry.indexOf("=");
          if (eqIdx > 0) {
            const key = entry.slice(0, eqIdx);
            const value = entry.slice(eqIdx + 1);
            envMap.set(key, value);
          }
        }
      } catch {
        envOutput = execSync(`ps eww -p ${pid} 2>/dev/null || true`, {
          encoding: "utf8",
          timeout: 1000,
        });
        parseEnvFromPs(envOutput, envMap);
      }
    } else if (platform() === "darwin") {
      envOutput = execSync(`ps eww -p ${pid} 2>/dev/null || true`, {
        encoding: "utf8",
        timeout: 1000,
      });
      parseEnvFromPs(envOutput, envMap);
    } else if (platform() === "win32") {
      try {
        envOutput = execSync(
          `wmic process where ProcessId=${pid} get CommandLine /format:list 2>nul`,
          { encoding: "utf8", timeout: 1000 }
        );
        const lines = envOutput.split("\n");
        for (const line of lines) {
          const eqIdx = line.indexOf("=");
          if (eqIdx > 0) {
            const key = line.slice(0, eqIdx).trim();
            const value = line.slice(eqIdx + 1).trim();
            if (key && value) envMap.set(key, value);
          }
        }
      } catch {
        // Windows environment detection is limited
      }
    }
  } catch { }

  return envMap;
}

/**
 * Parse environment variables from ps eww output.
 * Format: PID TTY STAT TIME COMMAND ENV1=val1 ENV2=val2 ...
 */
function parseEnvFromPs(psOutput, envMap) {
  const lines = psOutput.split("\n");
  for (const line of lines) {
    if (line.includes("PID") || !line.trim()) continue;
    
    const parts = line.split(/\s+/);
    for (const part of parts) {
      const eqIdx = part.indexOf("=");
      if (eqIdx > 0) {
        const key = part.slice(0, eqIdx);
        const value = part.slice(eqIdx + 1);
        if (isEnvironmentVar(key)) {
          envMap.set(key, value);
        }
      }
    }
  }
}

function isEnvironmentVar(key) {
  const envVars = [
    "NODE_ENV",
    "RAILS_ENV",
    "RACK_ENV",
    "FLASK_ENV",
    "FLASK_DEBUG",
    "DJANGO_SETTINGS_MODULE",
    "ASPNETCORE_ENVIRONMENT",
    "GO_ENV",
    "RUST_ENV",
    "ENVIRONMENT",
    "ENV",
    "APP_ENV",
    "DEBUG",
    "PRODUCTION",
    "DEVELOPMENT",
  ];
  return envVars.includes(key);
}

function detectFromEnvVars(envMap) {
  const nodeEnv = envMap.get("NODE_ENV");
  if (nodeEnv) {
    if (/^dev/i.test(nodeEnv)) return "development";
    if (/^prod/i.test(nodeEnv)) return "production";
    if (/^test/i.test(nodeEnv)) return "test";
    if (/^stag/i.test(nodeEnv)) return "staging";
  }

  const railsEnv = envMap.get("RAILS_ENV") || envMap.get("RACK_ENV");
  if (railsEnv) {
    if (/^dev/i.test(railsEnv)) return "development";
    if (/^prod/i.test(railsEnv)) return "production";
    if (/^test/i.test(railsEnv)) return "test";
    if (/^stag/i.test(railsEnv)) return "staging";
  }

  const flaskEnv = envMap.get("FLASK_ENV");
  if (flaskEnv) {
    if (/^dev/i.test(flaskEnv)) return "development";
    if (/^prod/i.test(flaskEnv)) return "production";
  }
  const flaskDebug = envMap.get("FLASK_DEBUG");
  if (flaskDebug === "1" || flaskDebug === "True") return "development";

  const djangoSettings = envMap.get("DJANGO_SETTINGS_MODULE");
  if (djangoSettings) {
    if (/\.production|\.prod/i.test(djangoSettings)) return "production";
    if (/\.development|\.dev/i.test(djangoSettings)) return "development";
    if (/\.test/i.test(djangoSettings)) return "test";
    if (/\.staging|\.stage/i.test(djangoSettings)) return "staging";
  }

  const aspnetEnv = envMap.get("ASPNETCORE_ENVIRONMENT");
  if (aspnetEnv) {
    if (/^dev/i.test(aspnetEnv)) return "development";
    if (/^prod/i.test(aspnetEnv)) return "production";
    if (/^stag/i.test(aspnetEnv)) return "staging";
  }

  const genericEnv = envMap.get("ENVIRONMENT") || envMap.get("ENV") || envMap.get("APP_ENV");
  if (genericEnv) {
    if (/^dev/i.test(genericEnv)) return "development";
    if (/^prod/i.test(genericEnv)) return "production";
    if (/^test/i.test(genericEnv)) return "test";
    if (/^stag/i.test(genericEnv)) return "staging";
  }

  const debug = envMap.get("DEBUG");
  if (debug === "1" || debug === "true" || debug === "True") return "development";

  return null;
}

function detectFromCommand(command) {
  const cmd = command.toLowerCase();

  if (/--env[=\s]+prod|--environment[=\s]+prod/i.test(cmd)) return "production";
  if (/--env[=\s]+dev|--environment[=\s]+dev/i.test(cmd)) return "development";
  if (/--env[=\s]+test|--environment[=\s]+test/i.test(cmd)) return "test";
  if (/--env[=\s]+stag|--environment[=\s]+stag/i.test(cmd)) return "staging";

  if (/--mode[=\s]+prod/i.test(cmd)) return "production";
  if (/--mode[=\s]+dev/i.test(cmd)) return "development";
  if (/--mode[=\s]+test/i.test(cmd)) return "test";

  if (/\s--production\b|\s-p\b/.test(cmd)) return "production";
  if (/\s--development\b|\s--dev\b/.test(cmd)) return "development";

  if (/vite\s+build/.test(cmd)) return "production";
  if (/vite\s+(dev|serve)/.test(cmd)) return "development";

  if (/next\s+build/.test(cmd)) return "production";
  if (/next\s+dev/.test(cmd)) return "development";
  if (/next\s+start/.test(cmd)) return "production";

  if (/manage\.py\s+runserver/.test(cmd)) return "development";

  if (/\bgunicorn\b/.test(cmd)) return "production";

  if (/uvicorn.*--reload/.test(cmd)) return "development";

  return null;
}

function detectFromProcessName(processName, command) {
  const name = (processName || "").toLowerCase();
  const cmd = command.toLowerCase();

  if (/npm\s+run\s+dev|yarn\s+dev|pnpm\s+dev/.test(cmd)) return "development";
  if (/npm\s+run\s+build|yarn\s+build|pnpm\s+build/.test(cmd)) return "production";
  if (/npm\s+run\s+test|yarn\s+test|pnpm\s+test/.test(cmd)) return "test";
  if (/npm\s+start|yarn\s+start|pnpm\s+start/.test(cmd)) return "production";

  if (name === "nodemon" || /\bnodemon\b/.test(cmd)) return "development";

  if (name === "pm2" || /\bpm2\b/.test(cmd)) return "production";

  if (/rails\s+server|rails\s+s\b/.test(cmd)) return "development";

  if (/flask\s+run/.test(cmd)) return "development";

  if (/webpack-dev-server|webpack\s+serve/.test(cmd)) return "development";

  if (/\b(jest|mocha|vitest|pytest|rspec)\b/.test(cmd)) return "test";

  return null;
}
