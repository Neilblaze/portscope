import chalk from "chalk";
import { execSync } from "child_process";
import { createInterface } from "readline";

/**
 * Intercept permission denied errors and prompt for sudo elevation.
 * @param {string} actionDesc - Description of the action (e.g. "Read logs for PID 123")
 * @param {string} sudoCommand - The raw command to run under sudo (e.g. "kill -9 123")
 * @param {import("readline").Interface} [rl] - Optional readline interface to reuse
 * @returns {Promise<{success: boolean, output?: string, error?: string}>}
 */
export async function promptSudoAction(actionDesc, sudoCommand, rl) {
  if (process.platform === "win32") {
    console.log(chalk.red(`\n  ⚠ Permission Denied. This process requires elevated privileges.`));
    console.log(chalk.yellow(`  ❯ Please run PortScope as Administrator to ${actionDesc.toLowerCase()}.\n`));
    return { success: false, error: "Windows requires running as Administrator." };
  }

  console.log(chalk.red(`\n  ⚠ Permission Denied. This process is owned by root.`));

  const answer = await new Promise((resolve) => {
    if (rl) {
      rl.question(chalk.yellow(`  ❯ Run this action with sudo? [y/N] `), resolve);
    } else {
      const tempRl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      tempRl.question(chalk.yellow(`  ❯ Run this action with sudo? [y/N] `), (ans) => {
        tempRl.close();
        resolve(ans);
      });
    }
  });

  if (answer.trim().toLowerCase() === "y") {
    try {
      // Use stdio inherit so sudo can prompt for password natively.
      // We pipe stdout to capture the result (e.g. for lsof), but inherit stdin/stderr for password prompt.
      const result = execSync(`sudo ${sudoCommand}`, {
        encoding: "utf8",
        stdio: ["inherit", "pipe", "inherit"],
      });
      return { success: true, output: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  return { success: false, error: "User declined sudo." };
}
