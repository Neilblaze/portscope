import { getAllProcesses } from "../scanner/process.js";
import { isDevProcess } from "../scanner/utils.js";
import { displayProcessTable } from "../ui/tables.js";


export async function psCommand(showAll, showBanner = true) {
  let processes = await getAllProcesses();
  if (!showAll) {
    processes = processes.filter((p) =>
      isDevProcess(p.processName, p.command),
    );
    const dockerProcs = processes.filter(
      (p) =>
        p.processName.startsWith("com.docke") ||
        p.processName.startsWith("Docker") ||
        p.processName === "docker" ||
        p.processName === "docker-sandbox",
    );
    const nonDocker = processes.filter(
      (p) =>
        !p.processName.startsWith("com.docke") &&
        !p.processName.startsWith("Docker") &&
        p.processName !== "docker" &&
        p.processName !== "docker-sandbox",
    );
    if (dockerProcs.length > 0) {
      const totalCpu = dockerProcs.reduce((s, p) => s + p.cpu, 0);
      const totalRssKB = dockerProcs.reduce((s, p) => {
        const m = (p.memory || "").match(/([\d.]+)\s*(GB|MB|KB)/);
        if (!m) return s;
        const val = parseFloat(m[1]);
        if (m[2] === "GB") return s + val * 1048576;
        if (m[2] === "MB") return s + val * 1024;
        return s + val;
      }, 0);
      const memStr =
        totalRssKB > 1048576
          ? `${(totalRssKB / 1048576).toFixed(1)} GB`
          : totalRssKB > 1024
            ? `${(totalRssKB / 1024).toFixed(1)} MB`
            : `${Math.round(totalRssKB)} KB`;
      nonDocker.push({
        pid: dockerProcs[0].pid,
        processName: "Docker",
        command: "",
        description: `${dockerProcs.length} processes`,
        cpu: totalCpu,
        memory: memStr,
        cwd: null,
        projectName: null,
        framework: "Docker",
        uptime: dockerProcs[0].uptime,
      });
    }
    processes = nonDocker;
  }
  processes.sort((a, b) => b.cpu - a.cpu);
  await displayProcessTable(processes, !showAll, showBanner);
}

