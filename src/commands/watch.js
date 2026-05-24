import { getListeningPorts, watchPorts } from "../scanner/ports.js";
import { displayWatchEvent, displayWatchHeader, getWatchSeparator } from "../ui/watch.js";
import chalk from "chalk";

export async function watchCommand() {
  displayWatchHeader();

  const processNames = new Set();
  
  try {
    const initialPorts = await getListeningPorts();
    for (const p of initialPorts) {
      processNames.add(`${p.processName || "unknown"} [${p.pid}]`);
    }
  } catch (err) {
    // Ignore error, it will just fall back to dynamic width
  }

  const interval = watchPorts((type, info) => {
    const nameAndPid = `${info.processName || "unknown"} [${info.pid}]`;
    if (type === "new" || type === "update") {
      processNames.add(nameAndPid);
    } else if (type === "removed") {
    }

    const maxWidth = Math.max(
      ...Array.from(processNames).map(name => name.length),
      0
    );

    displayWatchEvent(type, info, maxWidth);
  }, 2000);

  await new Promise((resolve) => {
    const sigintHandler = () => {
      clearInterval(interval);
      console.log(getWatchSeparator());
      console.log(`  ${chalk.red("■")} ${chalk.white.bold("Watch mode stopped")}`);
      console.log(chalk.dim("    Returned to interactive prompt.\n"));
      process.off("SIGINT", sigintHandler);
      resolve();
    };
    process.once("SIGINT", sigintHandler);
  });
}
