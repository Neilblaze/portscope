import os from "os";
import { execSync } from "child_process";
import fs from "fs";

/**
 * Returns the true available memory (including reclaimable cache/buffers)
 * because os.freemem() only returns completely unallocated memory.
 * 
 * @returns {number} Available memory in bytes
 */
export function getAvailableMemory() {
  const platform = os.platform();
  let available = os.freemem(); // fallback

  try {
    if (platform === "linux") {
      const meminfo = fs.readFileSync("/proc/meminfo", "utf8");
      const match = meminfo.match(/MemAvailable:\s+(\d+)\s+kB/);
      if (match) {
        available = parseInt(match[1], 10) * 1024;
      }
    } else if (platform === "darwin") {
      const vmStat = execSync("vm_stat", { encoding: "utf8", timeout: 1000 });
      const pageSizeMatch = vmStat.match(/page size of (\d+) bytes/);
      const pageSize = pageSizeMatch ? parseInt(pageSizeMatch[1], 10) : 4096;
      
      const freeMatch = vmStat.match(/Pages free:\s+(\d+)/);
      const inactiveMatch = vmStat.match(/Pages inactive:\s+(\d+)/);
      const speculativeMatch = vmStat.match(/Pages speculative:\s+(\d+)/);
      
      const free = freeMatch ? parseInt(freeMatch[1], 10) : 0;
      const inactive = inactiveMatch ? parseInt(inactiveMatch[1], 10) : 0;
      const speculative = speculativeMatch ? parseInt(speculativeMatch[1], 10) : 0;

      // Available is roughly (Free + Inactive + Speculative)
      available = (free + inactive + speculative) * pageSize;
    }
  } catch (e) {
    // Ignore and fallback to os.freemem()
  }
  
  return available;
}
