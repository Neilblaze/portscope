import chalk from "chalk";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));


/**
 * Print lines with a staggered reveal (each line appears after a delay).
 * @param {string[]} lines
 * @param {number} [delayMs=35] — delay between lines
 */
export async function staggerPrint(lines, delayMs = 35) {
  if (!process.stdout.isTTY) {
    for (const line of lines) console.log(line);
    return;
  }
  for (const line of lines) {
    console.log(line);
    await sleep(delayMs);
  }
}


/**
 * Animated clear — wipes N lines bottom-to-top with a sweep effect.
 * @param {number} lineCount — number of lines to sweep
 */
export async function sweepClear(lineCount) {
  if (!process.stdout.isTTY || lineCount <= 0) return;
  const rows = Math.min(lineCount, 30);
  for (let i = 0; i < rows; i++) {
    process.stdout.write(`\x1b[1A\x1b[2K`);
    await sleep(20);
  }
}


/**
 * Flash a success checkmark — briefly highlights then settles.
 * @param {string} message
 */
export async function flashSuccess(message) {
  if (!process.stdout.isTTY) {
    console.log(chalk.green(`  ✓ ${message}`));
    return;
  }
  process.stdout.write(chalk.bgGreen.black(` ✓ ${message} `) + "\r");
  await sleep(250);
  process.stdout.write("\x1b[2K\r");
  console.log(chalk.green(`  ✓ ${message}`));
}
