import { findOrphanedProcesses, killProcess } from "../scanner/process.js";
import { displayCleanResults } from "../ui/clean.js";
import chalk from "chalk";
import { createInterface } from "readline";


export async function cleanCommand(rl) {
  const orphaned = await findOrphanedProcesses();
  const killed = [];
  const failed = [];

  if (orphaned.length === 0) {
    displayCleanResults(orphaned, killed, failed);
    return;
  }

  const isCli = !rl;
  if (isCli) {
    rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  console.log();
  console.log(
    chalk.yellow.bold(
      `  Found ${orphaned.length} orphaned/zombie process${orphaned.length === 1 ? "" : "es"}:`,
    ),
  );
  for (const p of orphaned) {
    console.log(
      `  ${chalk.gray("•")} :${chalk.white.bold(p.port)} — ${p.processName} ${chalk.gray(`(PID ${p.pid})`)}`,
    );
  }
  console.log();

  const answer = await new Promise((resolve) => {
    rl.question(chalk.yellow("  Kill all? [y/N] "), resolve);
  });

  if (answer.toLowerCase() === "y") {
    for (const p of orphaned) {
      if (killProcess(p.pid)) {
        killed.push(p.pid);
      } else {
        failed.push(p.pid);
      }
    }
    displayCleanResults(orphaned, killed, failed);
  } else {
    console.log(chalk.gray("\n  Aborted.\n"));
  }

  if (isCli) {
    rl.close();
  }
}

