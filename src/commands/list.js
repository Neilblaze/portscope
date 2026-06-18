import chalk from "chalk";
import { getListeningPorts } from "../scanner/ports.js";
import { isDevProcess, formatUptime } from "../scanner/utils.js";
import { displayPortTable } from "../ui/tables.js";
import { renderBanner } from "../ui/banner.js";

export async function listCommand(showAll, showBanner = true) {
  let ports = await getListeningPorts();
  if (!showAll) {
    ports = ports.filter((p) => isDevProcess(p.processName, p.command));
  }
  await displayPortTable(ports, !showAll, showBanner);
}


export async function listLiveCommand(showAll, rl = null, intervalMs = 2000) {
  const isRepl = process.env.PORTSCOPE_REPL_ACTIVE === "true";

  console.clear();
  await renderBanner();

  let previousPorts = new Map();
  let lastRenderedLineCount = 0;

  const fetchPorts = async () => {
    let ports = await getListeningPorts();
    if (!showAll) {
      ports = ports.filter((p) => isDevProcess(p.processName, p.command));
    }
    return ports;
  };

  const renderTable = async (ports) => {
    const lines = [];
    const origLog = console.log;
    console.log = (...args) => {
      const output = args.map(String).join(" ");
      lines.push(...output.split("\n"));
    };

    await displayPortTable(ports, !showAll, false);

    console.log = origLog;
    return lines;
  };

  const clearPreviousRender = () => {
    if (lastRenderedLineCount > 0) {
      for (let i = 0; i < lastRenderedLineCount; i++) {
        process.stdout.write("\x1b[1A\x1b[2K");
      }
    }
  };

  let runningFetch = false;
  let runningRender = false;
  let tickCount = 0;
  let currentPorts = [];

  const getHeaderLine = () => {
    const isBright = tickCount % 2 === 0;
    const dot = isBright ? chalk.redBright("●") : chalk.red.dim("●");
    const prefix = isRepl ? "    " : "  ";
    return `${prefix}${dot} ${chalk.yellow.bold("LIVE")} ${chalk.dim("— auto-refreshes every " + (intervalMs / 1000) + "s · Ctrl+C to stop")}`;
  };

  const fetchTick = async () => {
    if (runningFetch) return;
    runningFetch = true;
    try {
      currentPorts = await fetchPorts();
      const currentMap = new Map(currentPorts.map((p) => [p.port, p]));
      previousPorts = currentMap;
    } finally {
      runningFetch = false;
    }
  };

  const renderTick = async () => {
    if (runningRender) return;
    runningRender = true;
    try {
      for (const p of currentPorts) {
        if (p.startTime && !isNaN(p.startTime.getTime())) {
          p.uptime = formatUptime(Date.now() - p.startTime.getTime());
        }
      }

      clearPreviousRender();

      const tableLines = await renderTable(currentPorts);

      const allLines = [
        "",
        getHeaderLine(),
        "",
        ...tableLines
      ];

      for (const line of allLines) {
        console.log(line);
      }

      lastRenderedLineCount = allLines.length;
      tickCount++;
    } finally {
      runningRender = false;
    }
  };

  await fetchTick();
  await renderTick();

  const fetchIntervalId = setInterval(fetchTick, intervalMs);
  const renderIntervalId = setInterval(renderTick, 1000);

  await new Promise((resolve) => {
    let fired = false;

    const cleanup = () => {
      if (fired) return;
      fired = true;
      clearInterval(fetchIntervalId);
      clearInterval(renderIntervalId);

      const prefix = isRepl ? "    " : "  ";
      console.log();
      console.log(`${prefix}${chalk.red("■")} ${chalk.white.bold("Live mode stopped")}`);
      if (isRepl) {
        console.log(chalk.dim(`${prefix}Returned to interactive prompt.\n`));
      } else {
        console.log();
      }

      process.off("SIGINT", onSigint);
      process.stdin.removeListener("data", onStdinData);

      resolve();
    };

    const onSigint = () => cleanup();
    const onStdinData = (data) => {
      // 0x03 = Ctrl+C (ETX)
      if (data && data.length === 1 && data[0] === 0x03) {
        cleanup();
      }
    };

    process.once("SIGINT", onSigint);

    if (process.stdin.isTTY && !process.stdin.isRaw) {
      process.stdin.setRawMode(true);
    }
    process.stdin.on("data", onStdinData);
  });
}
