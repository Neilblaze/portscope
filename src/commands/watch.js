import { watchPorts } from "../scanner/ports.js";
import { displayWatchEvent, displayWatchHeader } from "../ui/watch.js";
import chalk from "chalk";


export async function watchCommand() {
  displayWatchHeader();
  
  const processNames = new Set();
  
  const interval = watchPorts((type, info) => {
    if (type === "new" || type === "update") {
      processNames.add(info.processName || "");
    } else if (type === "removed") {
    }
    
    const maxWidth = Math.max(
      ...Array.from(processNames).map(name => name.length),
      10 // min width
    );
    
    displayWatchEvent(type, info, maxWidth);
  }, 2000);

  await new Promise((resolve) => {
    const sigintHandler = () => {
      clearInterval(interval);
      console.log(chalk.gray("\n\n  Stopped watching.\n"));
      process.off("SIGINT", sigintHandler);
      resolve();
    };
    process.once("SIGINT", sigintHandler);
  });
}
