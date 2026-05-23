import { resolveKillTarget } from "../scanner/process.js";
import { getProcessLogFiles, getSystemLogCommand } from "../scanner/logs.js";
import chalk from "chalk";
import { createInterface } from "readline";
import { spawn } from "child_process";


function spawnTail(filePath, numLines, follow = true) {
  if (process.platform === "win32") {
    const waitFlag = follow ? " -Wait" : "";
    return spawn(
      "powershell",
      [
        "-Command",
        `Get-Content -Path '${filePath}' -Tail ${numLines}${waitFlag}`,
      ],
      { stdio: "inherit" },
    );
  }
  const args = follow
    ? ["-f", "-n", numLines, filePath]
    : ["-n", numLines, filePath];
  return spawn("tail", args, { stdio: "inherit" });
}

export async function logsCommand(filteredArgs) {
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

  if (logsArgs.length === 0) {
    console.log(
      chalk.red(
        `\n  Usage: portscope logs <port|pid> [-f] [--lines=N] [--err]\n`,
      ),
    );
    console.log(
      chalk.gray("  Show log output for a process running on a port."),
    );
    console.log(
      chalk.gray("  Use -f or --follow to stream new lines.\n"),
    );
    return;
  }

  const target = parseInt(logsArgs[0], 10);
  if (isNaN(target)) {
    console.log(
      chalk.red(`\n  ✕ "${logsArgs[0]}" is not a valid port/PID\n`),
    );
    return;
  }

  const resolved = await resolveKillTarget(target);
  if (!resolved) {
    const msg =
      target <= 65535
        ? `No listener on :${target} and no process with PID ${target}`
        : `No process with PID ${target}`;
    console.log(chalk.red(`\n  ✕ ${msg}\n`));
    return;
  }

  const { pid, via } = resolved;
  const portLabel = via === "port" ? `:${resolved.port}` : `PID ${pid}`;
  const processName = resolved.info?.processName || "unknown";

  console.log();
  console.log(
    chalk.cyan.bold("  PortScope") +
    chalk.gray(` — logs for ${portLabel} (${processName}, PID ${pid})`),
  );
  console.log();

  const logFiles = await getProcessLogFiles(pid, rl);

  if (errOnly) {
    const stderrFile = logFiles.find((f) => f.fd === "stderr");
    if (stderrFile) {
      console.log(
        `  ${chalk.yellow("▸")} Tailing stderr: ${chalk.dim(stderrFile.path)}\n`,
      );
      const tail = spawnTail(stderrFile.path, lines, follow);
      if (follow) {
        await new Promise((resolve) => {
          process.on("SIGINT", () => {
            tail.kill("SIGTERM");
            resolve();
          });
        });
      } else {
        await new Promise((resolve) => tail.on("close", resolve));
      }
      return;
    }
    console.log(
      chalk.yellow(`  No stderr redirect found for PID ${pid}\n`),
    );
    return;
  }

  if (logFiles.length > 0) {
    if (logFiles.length === 1) {
      const f = logFiles[0];
      const label =
        f.fd === "stdout"
          ? "stdout"
          : f.fd === "stderr"
            ? "stderr"
            : "log";
      console.log(
        `  ${chalk.green("▸")} Tailing ${label}: ${chalk.dim(f.path)}\n`,
      );
      const tail = spawnTail(f.path, lines, follow);
      if (follow) {
        await new Promise((resolve) => {
          process.on("SIGINT", () => {
            tail.kill("SIGTERM");
            resolve();
          });
        });
      } else {
        await new Promise((resolve) => tail.on("close", resolve));
      }
      return;
    }

    console.log(chalk.bold("  Found log files:\n"));
    logFiles.forEach((f, i) => {
      const label =
        f.fd === "stdout"
          ? chalk.green("stdout")
          : f.fd === "stderr"
            ? chalk.yellow("stderr")
            : chalk.dim(f.type);
      console.log(
        `    ${chalk.white.bold(i + 1)}  ${label}  ${chalk.dim(f.path)}`,
      );
    });
    console.log();

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const answer = await new Promise((resolve) => {
      rl.question(
        chalk.yellow(`  Pick a file (1-${logFiles.length}): `),
        resolve,
      );
    });
    rl.close();

    const idx = parseInt(answer, 10) - 1;
    if (idx < 0 || idx >= logFiles.length) {
      console.log(chalk.red("\n  Invalid selection.\n"));
      return;
    }

    const selected = logFiles[idx];
    console.log(
      `\n  ${chalk.green("▸")} Tailing: ${chalk.dim(selected.path)}\n`,
    );
    const tail = spawnTail(selected.path, lines, follow);
    if (follow) {
      await new Promise((resolve) => {
        process.on("SIGINT", () => {
          tail.kill("SIGTERM");
          resolve();
        });
      });
    } else {
      await new Promise((resolve) => tail.on("close", resolve));
    }
    return;
  }


  const sysCmd = getSystemLogCommand(pid, follow);
  if (sysCmd) {
    console.log(
      chalk.yellow(
        `  No log files found. Falling back to system log...\n`,
      ),
    );
    console.log(`  ${chalk.dim(`$ ${sysCmd}`)}\n`);
    const [cmd, ...sysArgs] = sysCmd.split(" ");
    const proc = spawn(cmd, sysArgs, { stdio: "inherit" });
    if (follow) {
      await new Promise((resolve) => {
        process.on("SIGINT", () => {
          proc.kill("SIGTERM");
          resolve();
        });
      });
    } else {
      await new Promise((resolve) => proc.on("close", resolve));
    }
    return;
  }

  console.log(
    chalk.yellow(`  No log files or system log found for PID ${pid}.\n`),
  );
  console.log(
    chalk.dim(
      `  Tip: if the process logs to the terminal, check the terminal where it was started.\n`,
    ),
  );
}
