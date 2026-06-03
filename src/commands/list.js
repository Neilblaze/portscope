import { getListeningPorts } from "../scanner/ports.js";
import { isDevProcess } from "../scanner/utils.js";
import { displayPortTable } from "../ui/tables.js";

export async function listCommand(showAll, showBanner = true) {
  let ports = await getListeningPorts();
  if (!showAll) {
    ports = ports.filter((p) => isDevProcess(p.processName, p.command));
  }
  await displayPortTable(ports, !showAll, showBanner);
}
