import { watchPorts } from "../scanner/ports.js";
import { displayWatchEvent, displayWatchHeader } from "../ui/watch.js";
import chalk from "chalk";

export async function watchCommand() {
  displayWatchHeader();
  const interval = watchPorts((type, info) => {
    displayWatchEvent(type, info);
  }, 2000);

  process.on("SIGINT", () => {
    clearInterval(interval);
    console.log(chalk.gray("\n\n  Stopped watching.\n"));
    process.exit(0);
  });
}
