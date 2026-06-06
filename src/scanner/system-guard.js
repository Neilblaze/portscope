/**
 * System process guard — OS-aware blocklist
 *
 * Prevents PortScope from sending any signal to PIDs or process names that
 * are part of the host operating system. The check is intentionally strict:
 * if there is any doubt, we block.
 *
 * Covered surfaces:
 *   - PID 0 and PID 1 (always blocked, on every platform)
 *   - macOS:   launchd, kernel_task, WindowServer, syslogd, notifyd, configd,
 *              mDNSResponder, opendirectoryd, loginwindow, SpringBoard, etc.
 *   - Linux:   systemd, init, kthreadd, ksoftirqd, rcu_*, watchdog, sshd,
 *              udevd, journald, dbus-daemon, NetworkManager, etc.
 *   - Windows: System, smss.exe, csrss.exe, wininit.exe, services.exe,
 *              lsass.exe, svchost.exe, winlogon.exe, etc.
 *
 * Returns a { blocked: true, reason: string } object when a process is blocked,
 * or { blocked: false } when it is safe to proceed.
 */


// PID-level guard
const BLOCKED_PIDS = new Set([0, 1]);

// Name-level guards
const BLOCKED_NAMES_DARWIN = new Set([
  "launchd",
  "kernel_task",
  "kernelmanagerd",
  "windowserver",
  "loginwindow",
  "syslogd",
  "notifyd",
  "configd",
  "mdnsresponder",
  "opendirectoryd",
  "diskarbitrationd",
  "powerd",
  "coreaudiod",
  "securityd",
  "distnoted",
  "cfprefsd",
  "lsd",
  "airportd",
  "systemstats",
  "kextd",
  "amfid",
  "syspolicyd",
  "endpointsecurityd",
  "trustd",
  "symptomsd",
  "bluetoothd",
  "locationd",
  "logd",
  "iconservicesagent",
  "coreservicesd",
  "usbd",
  "hidd",
  "apsd",
  "nsurlsessiond",
  "dasd",
  "watchdogd",
  "apfsd",
  "fseventsd",
  "mediaserverd",
  "timed",
  "ntp",
  "ntpd",
  "ssh",
  "sshd",
  "sshoffer",
]);

const BLOCKED_NAMES_LINUX = new Set([
  "systemd",
  "init",
  "kthreadd",
  "kworker",
  "ksoftirqd",
  "migration",
  "rcu_bh",
  "rcu_sched",
  "rcu_tasks",
  "rcu_preempt",
  "watchdog",
  "cpuhp",
  "lru-add-drain",
  "kswapd",
  "kauditd",
  "kdevtmpfs",
  "netns",
  "khungtaskd",
  "oom_reaper",
  "writeback",
  "kcompactd",
  "khugepaged",
  "crypto",
  "bioset",
  "kblockd",
  "md",
  "edac-poller",
  "devfreq_wq",
  "irq",
  "sshd",
  "udevd",
  "systemd-journald",
  "systemd-udevd",
  "systemd-logind",
  "systemd-resolved",
  "systemd-networkd",
  "systemd-timesyncd",
  "dbus-daemon",
  "NetworkManager",
  "networkmanager",
  "wpa_supplicant",
  "polkitd",
  "gdm",
  "lightdm",
  "pulseaudio",
  "pipewire",
  "avahi-daemon",
  "rsyslogd",
  "cron",
  "crond",
  "containerd",
  "dockerd",
  "ntpd",
  "chronyd",
  "multipathd",
  "snapd",
  "thermald",
  "irqbalance",
  "gssproxy",
  "rpcbind",
  "atd",
  "auditd",
  "firewalld",
]);

const BLOCKED_NAMES_WIN32 = new Set([
  "system",
  "system idle process",
  "smss.exe",
  "csrss.exe",
  "wininit.exe",
  "winlogon.exe",
  "services.exe",
  "lsass.exe",
  "lsm.exe",
  "svchost.exe",
  "dwm.exe",
  "explorer.exe",    // NOTE: technically user-killable but very risky
  "taskmgr.exe",
  "spoolsv.exe",
  "msdtc.exe",
  "dllhost.exe",
  "conhost.exe",
  "fontdrvhost.exe",
  "wlanext.exe",
  "audiodg.exe",
  "sihost.exe",
  "taskhostw.exe",
  "ctfmon.exe",
  "runtimebroker.exe",
  "searchindexer.exe",
  "wuauclt.exe",
  "msiexec.exe",
]);

function getBlockedNamesForPlatform() {
  switch (process.platform) {
    case "darwin": return BLOCKED_NAMES_DARWIN;
    case "linux": return BLOCKED_NAMES_LINUX;
    case "win32": return BLOCKED_NAMES_WIN32;
    default: return new Set();
  }
}


export function isSystemProcess(pid, processName) {
  if (BLOCKED_PIDS.has(pid)) {
    return {
      blocked: true,
      reason: pid === 0
        ? "PID 0 is the kernel idle process and cannot be signalled"
        : "PID 1 is the init/launchd/systemd root process — killing it would crash your OS",
    };
  }

  if (processName) {
    const name = processName.toLowerCase().replace(/\s+/g, " ").trim();
    const blocked = getBlockedNamesForPlatform();

    if (blocked.has(name)) {
      return { blocked: true, reason: `"${processName}" is a protected OS system process` };
    }

    if (process.platform === "linux") {
      if (
        name.startsWith("kworker/") ||
        name.startsWith("rcu_") ||
        name.startsWith("irq/") ||
        name.startsWith("ksoftirqd/") ||
        name.startsWith("watchdog/") ||
        name.startsWith("migration/") ||
        name.startsWith("cpuhp/")
      ) {
        return { blocked: true, reason: `"${processName}" is a protected Linux kernel thread` };
      }
    }
  }

  return { blocked: false };
}


export function formatBlockMessage(pid, processName, reason) {
  const nameStr = processName ? ` (${processName})` : "";
  return `  ⛊  Blocked — PID ${pid}${nameStr}\n  ${reason}`;
}
