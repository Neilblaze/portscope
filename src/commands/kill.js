import { resolveKillTarget, killProcess } from "../scanner/process.js";
import { getListeningPorts } from "../scanner/ports.js";
import { isDevProcess } from "../scanner/utils.js";
import chalk from "chalk";
import { createInterface } from "readline";


export async function killCommand(filteredArgs, rl) {
  const rawKillArgs = filteredArgs
    .slice(1)
    .filter((a) => a !== "--force" && a !== "-f");
  const force =
    filteredArgs.includes("--force") || filteredArgs.includes("-f");
  const signal = force ? "SIGKILL" : "SIGTERM";

  if (rawKillArgs.length === 0) {
    console.log(
      chalk.red(
        `\n  Usage: portscope kill [-f|--force] <port|pid|range|all> [port,port,...]\n`,
      ),
    );
    console.log(
      chalk.gray(
        "  Kills listener on port (1-65535), or process by PID. Use -f for SIGKILL.",
      ),
    );
    console.log(chalk.gray("  Ranges:  portscope kill 3000-3010"));
    console.log(chalk.gray("  Comma:   portscope kill 3000,5173,8080"));
    console.log(chalk.gray("  All:     portscope kill all\n"));
    return;
  }

  // ── "kill all" — kill every listening dev port ─── //
  if (rawKillArgs[0]?.toLowerCase() === "all") {
    await killAllDevPorts(force, signal, rl);
    return;
  }

  const expandedArgs = [];
  for (const arg of rawKillArgs) {
    if (arg.includes(",")) {
      expandedArgs.push(...arg.split(",").map((s) => s.trim()).filter(Boolean));
    } else {
      expandedArgs.push(arg);
    }
  }

  const killArgs = [];
  const rangeSpans = [];
  for (const arg of expandedArgs) {
    const rangeMatch = arg.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      if (start > end) {
        console.log(
          chalk.red(
            `\n  ✕ Invalid range: ${arg} (start must be less than end)\n`,
          ),
        );
        process.exitCode = 1;
        return;
      }
      if (end - start > 1000) {
        console.log(
          chalk.red(`\n  ✕ Range too large: ${arg} (max 1000 ports)\n`),
        );
        process.exitCode = 1;
        return;
      }
      if (start < 1 || end > 65535) {
        console.log(
          chalk.red(
            `\n  ✕ Invalid range: ${arg} (ports must be 1-65535)\n`,
          ),
        );
        process.exitCode = 1;
        return;
      }
      const rangeStart = killArgs.length;
      for (let p = start; p <= end; p++) {
        killArgs.push(String(p));
      }
      rangeSpans.push({
        start: rangeStart,
        end: killArgs.length,
        label: arg,
      });
    } else {
      killArgs.push(arg);
    }
  }

  let anyFailed = false;
  let killed = 0;
  let noListener = 0;
  console.log();

  for (let i = 0; i < killArgs.length; i++) {
    const arg = killArgs[i];
    const n = parseInt(arg, 10);
    const isFromRange = rangeSpans.some((r) => i >= r.start && i < r.end);

    if (isNaN(n) || String(n) !== arg.trim()) {
      console.log(chalk.red(`  ✕ "${arg}" is not a valid port/PID`));
      anyFailed = true;
      continue;
    }

    const resolved = await resolveKillTarget(n);
    if (!resolved) {
      // Silently count misses from ranges instead of spamming
      if (isFromRange) {
        noListener++;
        continue;
      }
      const msg =
        n <= 65535
          ? `No listener on :${n} and no process with PID ${n}`
          : `No process with PID ${n}`;
      console.log(chalk.red(`  ✕ ${msg}`));
      anyFailed = true;
      continue;
    }

    const { pid, via } = resolved;
    const label =
      via === "port"
        ? `:${resolved.port} — ${resolved.info?.processName || "unknown"} (PID ${pid})`
        : `PID ${pid}`;

    console.log(chalk.white(`  Killing ${label}`));
    const ok = killProcess(pid, signal);
    if (ok) {
      console.log(chalk.green(`  ✓ Sent ${signal} to ${label}`));
      killed++;
    } else {
      console.log(
        chalk.red(`  ✕ Failed. Try: sudo kill${force ? " -9" : ""} ${pid}`),
      );
      anyFailed = true;
    }
  }

  // Print summary for ranges
  if (rangeSpans.length > 0) {
    const parts = [];
    if (killed > 0) parts.push(chalk.green(`${killed} killed`));
    if (noListener > 0) parts.push(chalk.gray(`${noListener} empty`));
    if (anyFailed) parts.push(chalk.red(`some failed`));
    console.log(
      `  ${chalk.dim("Range summary:")} ${parts.join(chalk.dim(", "))}`,
    );
  }

  console.log();
  process.exitCode = anyFailed ? 1 : 0;
}

/**
 * Kill all listening dev server ports with mandatory y/N confirmation.
 */
async function killAllDevPorts(force, signal, rl) {
  let ports = await getListeningPorts();
  ports = ports.filter((p) => isDevProcess(p.processName, p.command));

  if (ports.length === 0) {
    console.log(chalk.gray("\n  No dev server ports found.\n"));
    return;
  }

  console.log();
  console.log(
    chalk.yellow.bold(
      `  Found ${ports.length} dev port${ports.length === 1 ? "" : "s"}:`,
    ),
  );
  for (const p of ports) {
    console.log(
      `  ${chalk.gray("•")} :${chalk.white.bold(p.port)} — ${p.processName} ${chalk.gray(`(PID ${p.pid})`)}`,
    );
  }
  console.log();

  const isCli = !rl;
  if (isCli) {
    rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  const answer = await new Promise((resolve) => {
    rl.question(
      chalk.yellow(`  Kill all ${ports.length} dev port${ports.length === 1 ? "" : "s"}? [y/N] `),
      resolve,
    );
  });

  if (isCli) {
    rl.close();
  }

  if (answer.toLowerCase() !== "y") {
    console.log(chalk.gray("\n  Aborted.\n"));
    return;
  }

  let killed = 0;
  let failed = 0;
  const seen = new Set();


  for (const p of ports) {
    // Avoid killing same PID twice (multiple ports on same process)
    if (seen.has(p.pid)) {
      killed++;
      continue;
    }
    seen.add(p.pid);

    const label = `:${p.port} — ${p.processName} (PID ${p.pid})`;
    const ok = killProcess(p.pid, signal);
    if (ok) {
      console.log(chalk.green(`  ✓ Sent ${signal} to ${label}`));
      killed++;
    } else {
      console.log(chalk.red(`  ✕ Failed: ${label}`));
      failed++;
    }
  }

  console.log();
  if (killed > 0) console.log(chalk.green(`  Killed ${killed} port${killed === 1 ? "" : "s"}.`));
  if (failed > 0) console.log(chalk.red(`  Failed to kill ${failed}.`));
  console.log();

  process.exitCode = failed > 0 ? 1 : 0;
}
