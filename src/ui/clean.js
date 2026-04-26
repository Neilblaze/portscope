import chalk from "chalk";
import { renderBanner } from "./banner.js";


// Display orphaned/zombie process cleanup results
export function displayCleanResults(orphaned, killed, failed) {
  renderBanner();

  if (orphaned.length === 0) {
    console.log(
      chalk.green("  ✓ No orphaned or zombie processes found. All clean!\n"),
    );
    return;
  }

  console.log(
    chalk.yellow.bold(
      `  Found ${orphaned.length} orphaned/zombie process${orphaned.length === 1 ? "" : "es"}:\n`,
    ),
  );

  for (const p of orphaned) {
    const wasKilled = killed.includes(p.pid);
    const didFail = failed.includes(p.pid);
    const icon = wasKilled
      ? chalk.green("✓")
      : didFail
        ? chalk.red("✕")
        : chalk.yellow("?");
    console.log(
      `  ${icon} :${chalk.white.bold(p.port)} ${chalk.gray("—")} ${p.processName} ${chalk.gray(`(PID ${p.pid})`)}`,
    );
    if (didFail) {
      console.log(chalk.red(`    Failed to kill. Try: sudo kill -9 ${p.pid}`));
    }
  }

  console.log();
  if (killed.length > 0) {
    console.log(
      chalk.green(
        `  Cleaned ${killed.length} process${killed.length === 1 ? "" : "es"}.`,
      ),
    );
  }
  if (failed.length > 0) {
    console.log(
      chalk.red(
        `  Failed to clean ${failed.length} process${failed.length === 1 ? "" : "es"}.`,
      ),
    );
  }
  console.log();
}
