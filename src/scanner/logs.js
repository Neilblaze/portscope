import { execSync } from "child_process";
import { existsSync, readFileSync, readdirSync, readlinkSync } from "fs";
import { join } from "path";

/**
 * Find log files for a given PID. Platform-aware:
 * - macOS/Linux: lsof to find open file descriptors
 * - Linux fallback: /proc/<pid>/fd symlinks
 * - Windows: common log path scanning
 * Returns array of { path, fd, type } sorted by relevance.
 */
export function getProcessLogFiles(pid) {
  const files = [];
  const plat = process.platform;

  if (plat === "darwin" || plat === "linux") {
    try {
      const raw = execSync(`lsof -p ${pid} 2>/dev/null`, {
        encoding: "utf8",
        timeout: 5000,
      }).trim();

      for (const line of raw.split("\n").slice(1)) {
        const cols = line.split(/\s+/);
        if (cols.length < 9) continue;

        const fd = cols[3];
        const type = cols[4];
        const name = cols.slice(8).join(" ");

        if ((fd === "1w" || fd === "2w") && type === "REG") {
          files.push({ path: name, fd: fd === "1w" ? "stdout" : "stderr", type: "redirect", priority: 1 });
          continue;
        }

        if (type === "REG" && /w$/.test(fd) && isLogLikePath(name)) {
          files.push({ path: name, fd: "file", type: "logfile", priority: 2 });
        }
      }
    } catch {
      // lsof not available — fall back to /proc on Linux
      if (plat === "linux") {
        try {
          const fdDir = `/proc/${pid}/fd`;
          for (const entry of readdirSync(fdDir)) {
            try {
              const target = readlinkSync(join(fdDir, entry));
              if (entry === "1" && !target.startsWith("/dev/") && !target.startsWith("pipe:")) {
                files.push({ path: target, fd: "stdout", type: "redirect", priority: 1 });
              } else if (entry === "2" && !target.startsWith("/dev/") && !target.startsWith("pipe:")) {
                files.push({ path: target, fd: "stderr", type: "redirect", priority: 1 });
              } else if (isLogLikePath(target)) {
                files.push({ path: target, fd: "file", type: "logfile", priority: 2 });
              }
            } catch { }
          }
        } catch { }
      }
    }
  }

  // Check common framework log locations relative to process cwd
  const cwdRaw = getProcessCwd(pid);
  if (cwdRaw) {
    const commonLogs = [
      ".next/server.log",
      "logs/development.log",
      "log/development.log",
      "tmp/pids/server.log",
      "storage/logs/laravel.log",
      "npm-debug.log",
      "yarn-error.log",
    ];
    for (const rel of commonLogs) {
      const full = join(cwdRaw, rel);
      if (existsSync(full)) {
        files.push({ path: full, fd: "file", type: "framework", priority: 3 });
      }
    }
  }

  files.sort((a, b) => a.priority - b.priority);
  const seen = new Set();
  return files.filter((f) => {
    if (seen.has(f.path)) return false;
    seen.add(f.path);
    return true;
  });
}

function isLogLikePath(name) {
  const lower = name.toLowerCase();
  return (
    lower.endsWith(".log") ||
    lower.includes("/log/") ||
    lower.includes("/logs/") ||
    lower.includes("\\log\\") ||
    lower.includes("\\logs\\") ||
    lower.includes("/tmp/") ||
    lower.includes("nohup.out") ||
    lower.includes("stdout") ||
    lower.includes("stderr")
  );
}

function getProcessCwd(pid) {
  try {
    if (process.platform === "linux") {
      return execSync(`readlink -f /proc/${pid}/cwd 2>/dev/null`, { encoding: "utf8", timeout: 3000 }).trim();
    }
    if (process.platform === "darwin") {
      return execSync(`lsof -p ${pid} -d cwd -Fn 2>/dev/null`, { encoding: "utf8", timeout: 3000 })
        .split("\n").find((l) => l.startsWith("n"))?.slice(1);
    }
    if (process.platform === "win32") {
      return execSync(
        `powershell -Command "(Get-Process -Id ${pid}).Path | Split-Path" 2>nul`,
        { encoding: "utf8", timeout: 5000 },
      ).trim() || null;
    }
  } catch { }
  return null;
}


// Get system log stream command for a PID (platform-specific)
export function getSystemLogCommand(pid, follow = false) {
  if (process.platform === "darwin") {
    return follow
      ? `log stream --predicate 'processID == ${pid}' --style compact`
      : `log show --predicate 'processID == ${pid}' --style compact --last 1m`;
  }
  if (process.platform === "linux") {
    return follow
      ? `journalctl _PID=${pid} -f --no-pager`
      : `journalctl _PID=${pid} --no-pager -n 50`;
  }
  if (process.platform === "win32") {
    return `powershell -Command "Get-WinEvent -FilterHashtable @{LogName='Application'; ProcessId=${pid}} -MaxEvents 50"`;
  }
  return null;
}
