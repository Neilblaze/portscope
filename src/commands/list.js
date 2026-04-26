import { getListeningPorts } from "../scanner/ports.js";
import { isDevProcess } from "../scanner/utils.js";
import { displayPortTable } from "../ui/tables.js";

export async function listCommand(showAll) {
  let ports = await getListeningPorts();
  if (!showAll) {
    ports = ports.filter((p) => isDevProcess(p.processName, p.command));
  }
  displayPortTable(ports, !showAll);
}
