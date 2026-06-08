import { getPortDetails } from "../scanner/ports.js";
import { killProcess } from "../scanner/process.js";
import { displayPortDetail } from "../ui/detail.js";
import chalk from "chalk";
import { createInterface } from "readline";


export async function inspectCommand(portNum) {
  const info = await getPortDetails(portNum);
  await displayPortDetail(info);

  if (info) {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(
      chalk.yellow(`  Kill process on :${portNum}? [y/N] `),
      async (answer) => {
        if (answer.toLowerCase() === "y") {
          const success = await killProcess(info.pid, "SIGTERM", rl);
          if (success) {
            console.log(chalk.green(`\n  ✔ Killed PID ${info.pid}\n`));
          } else {
            console.log(
              chalk.red(`\n  ✕ Failed. Try: sudo kill -9 ${info.pid}\n`),
            );
          }
        }
        rl.close();
      },
    );
  }
}
