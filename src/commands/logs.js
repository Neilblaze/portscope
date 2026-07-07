import { resolveKillTarget } from "../scanner/process.js";
import { getProcessLogFiles, getSystemLogCommand } from "../scanner/logs.js";
import { getListeningPorts } from "../scanner/ports.js";
import { isDevProcess } from "../scanner/utils.js";
import chalk from "chalk";
import { createInterface } from "readline";
import { spawn } from "child_process";

const COLORS = [
  chalk.cyan,
  chalk.magenta,
  chalk.blueBright,
  chalk.yellowBright,
  chalk.greenBright,
  chalk.redBright,
  chalk.whiteBright,
];

function spawnTail(filePath, numLines, follow = true) {
  if (process.platform === "win32") {
    const waitFlag = follow ? " -Wait" : "";
    return spawn(
      "powershell",
      [
        "-Command",
        `Get-Content -Path '${filePath}' -Tail ${numLines}${waitFlag}`,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
  }
  const args = follow
    ? ["-f", "-n", numLines, filePath]
    : ["-n", numLines, filePath];
  return spawn("tail", args, { stdio: ["ignore", "pipe", "pipe"] });
}

export async function logsCommand(filteredArgs, showAll) {
  const follow =
    filteredArgs.includes("-f") || filteredArgs.includes("--follow");
  const errOnly = filteredArgs.includes("--err");

  // Parse --lines=N or --lines N
  let lines = "50";
  const linesEqArg = filteredArgs.find((a) => a.startsWith("--lines="));
  if (linesEqArg) {
    lines = linesEqArg.split("=")[1];
  } else {
    const linesIdx = filteredArgs.indexOf("--lines");
    if (linesIdx !== -1 && filteredArgs[linesIdx + 1]) {
      lines = filteredArgs[linesIdx + 1];
    }
  }
  const logsArgs = filteredArgs
    .slice(1)
    .filter((a) => !a.startsWith("--") && a !== "-f" && a !== lines);

  let targetStrs = [];

  if (showAll) {
    const ports = await getListeningPorts();
    targetStrs = ports
      .filter((p) => isDevProcess(p.processName, p.command))
      .map((p) => p.port.toString());
  } else if (logsArgs.length > 0) {
    targetStrs = logsArgs
      .join(",")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  if (targetStrs.length === 0) {
    console.log(
      chalk.red(
        `\n  Usage: portscope logs <port|pid>[,<port2>] [-f] [--lines=N] [--err]\n`,
      ),
    );
    console.log(chalk.gray("         portscope logs --all [-f]\n"));
    console.log(
      chalk.gray("  Show log output for processes running on specified ports."),
    );
    console.log(
      chalk.gray("  Use -f or --follow to stream new lines.\n"),
    );
    return;
  }

  const activeProcesses = [];
  let hasTailedSomething = false;

  console.log();
  console.log(chalk.cyan.bold("  PortScope") + chalk.gray(` — logs`));
  console.log();

  for (let i = 0; i < targetStrs.length; i++) {
    const targetStr = targetStrs[i];
    const target = parseInt(targetStr, 10);
    if (isNaN(target)) {
      console.log(chalk.red(`  ✕ "${targetStr}" is not a valid port/PID`));
      continue;
    }

    const resolved = await resolveKillTarget(target);
    if (!resolved) {
      const msg =
        target <= 65535
          ? `No listener on :${target} and no process with PID ${target}`
          : `No process with PID ${target}`;
      console.log(chalk.red(`  ✕ [Target ${targetStr}] ${msg}`));
      continue;
    }

    const { pid, via } = resolved;
    const portLabel = via === "port" ? `:${resolved.port}` : `PID ${pid}`;
    const processName = resolved.info?.processName || "unknown";
    const colorFn = COLORS[i % COLORS.length];

    const label = colorFn(`[${processName} ${portLabel}]`);

    const logFiles = await getProcessLogFiles(pid, null);

    let selectedPath = null;
    let selectedLabel = null;
    let useSysLog = false;
    let sysCmdStr = null;

    if (errOnly) {
      const stderrFile = logFiles.find((f) => f.fd === "stderr");
      if (stderrFile) {
        selectedPath = stderrFile.path;
        selectedLabel = "stderr";
      } else {
        console.log(chalk.yellow(`  ⚠ ${label} No stderr redirect found.`));
        continue;
      }
    } else {
      if (logFiles.length > 0) {
        if (targetStrs.length === 1 && logFiles.length > 1) {
          console.log(chalk.bold(`  Found multiple log files for ${label}:\n`));
          logFiles.forEach((f, idx) => {
            const fLabel = f.fd === "stdout" ? chalk.green("stdout") : f.fd === "stderr" ? chalk.yellow("stderr") : chalk.dim(f.type);
            console.log(`    ${chalk.white.bold(idx + 1)}  ${fLabel}  ${chalk.dim(f.path)}`);
          });
          console.log();

          const rl = createInterface({
            input: process.stdin,
            output: process.stdout,
          });
          const answer = await new Promise((resolve) => {
            rl.question(chalk.yellow(`  Pick a file (1-${logFiles.length}): `), resolve);
          });
          rl.close();

          const idx = parseInt(answer, 10) - 1;
          if (idx >= 0 && idx < logFiles.length) {
            const f = logFiles[idx];
            selectedPath = f.path;
            selectedLabel = f.fd === "stdout" ? "stdout" : f.fd === "stderr" ? "stderr" : "log";
          } else {
            console.log(chalk.red("\n  Invalid selection. Skipping.\n"));
            continue;
          }
        } else {
          const f = logFiles[0];
          selectedPath = f.path;
          selectedLabel = f.fd === "stdout" ? "stdout" : f.fd === "stderr" ? "stderr" : "log";
        }
      } else {
        sysCmdStr = getSystemLogCommand(pid, follow);
        if (sysCmdStr) {
          useSysLog = true;
        } else {
          console.log(chalk.yellow(`  ⚠ ${label} No log files or system log found.`));
          continue;
        }
      }
    }

    hasTailedSomething = true;

    const handleStream = (stream, isError) => {
      if (!stream) return;
      let remainder = "";
      stream.on("data", (chunk) => {
        const text = remainder + chunk.toString("utf8");
        const linesArr = text.split("\n");
        remainder = linesArr.pop() || "";
        for (const line of linesArr) {
          process.stdout.write(`${label} ${isError ? chalk.red(line) : line}\n`);
        }
      });
      stream.on("end", () => {
        if (remainder) {
          process.stdout.write(`${label} ${isError ? chalk.red(remainder) : remainder}\n`);
        }
      });
    };

    if (!useSysLog) {
      console.log(`  ${chalk.green("▸")} Tailing ${selectedLabel} for ${label}: ${chalk.dim(selectedPath)}`);
      const tail = spawnTail(selectedPath, lines, follow);
      handleStream(tail.stdout, false);
      handleStream(tail.stderr, true);
      activeProcesses.push(tail);
    } else {
      console.log(chalk.yellow(`  ${chalk.green("▸")} No log files found for ${label}. Falling back to system log...`));
      const [cmd, ...sysArgs] = sysCmdStr.split(" ");
      const proc = spawn(cmd, sysArgs, { stdio: ["ignore", "pipe", "pipe"] });
      handleStream(proc.stdout, false);
      handleStream(proc.stderr, true);
      activeProcesses.push(proc);
    }
  }

  console.log();

  if (!hasTailedSomething) {
    return;
  }

  if (follow) {
    await new Promise((resolve) => {
      const cleanup = () => {
        for (const proc of activeProcesses) {
          try {
            proc.kill("SIGTERM");
          } catch (e) {
            // ignore
          }
        }
        resolve();
      };
      process.on("SIGINT", cleanup);
    });
  } else {
    const promises = activeProcesses.map(
      (proc) => new Promise((resolve) => proc.on("close", resolve))
    );
    await Promise.all(promises);
  }
}
