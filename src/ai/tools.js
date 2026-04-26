export const TOOLS = [
  {
    name: "list_ports",
    description:
      "List all listening ports on the system. Shows port number, process name, PID, project, framework, uptime, and status.",
    parameters: {
      type: "object",
      properties: {
        all: {
          type: "boolean",
          description:
            "If true, show all ports including system services. If false (default), show only dev server ports.",
        },
      },
    },
  },
  {
    name: "inspect_port",
    description:
      "Get detailed information about a specific port, including process tree, git branch, memory usage.",
    parameters: {
      type: "object",
      properties: {
        port: { type: "number", description: "Port number to inspect." },
      },
      required: ["port"],
    },
  },
  {
    name: "kill_process",
    description:
      "Kill a process by port number or PID. This is a destructive operation and requires user confirmation.",
    parameters: {
      type: "object",
      properties: {
        target: {
          type: "number",
          description: "Port number or PID to kill.",
        },
        force: {
          type: "boolean",
          description: "Use SIGKILL instead of SIGTERM.",
        },
      },
      required: ["target"],
    },
  },
  {
    name: "kill_all_dev_ports",
    description:
      "Kill ALL listening dev server ports in one go. This is a destructive operation and requires user confirmation. Use when the user wants to stop all running dev servers.",
    parameters: {
      type: "object",
      properties: {
        force: {
          type: "boolean",
          description: "Use SIGKILL instead of SIGTERM.",
        },
      },
    },
  },
  {
    name: "list_processes",
    description:
      "List all running dev processes with CPU, memory, framework, and uptime info.",
    parameters: {
      type: "object",
      properties: {
        all: {
          type: "boolean",
          description: "Show all processes, not just dev.",
        },
      },
    },
  },
  {
    name: "find_orphaned",
    description: "Find orphaned or zombie dev server processes.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "clean_orphaned",
    description:
      "Kill all orphaned/zombie dev server processes. This is a destructive operation and requires user confirmation.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "view_logs",
    description:
      "View the last N lines of log output for a process running on a specific port or PID.",
    parameters: {
      type: "object",
      properties: {
        target: {
          type: "number",
          description: "Port number or PID.",
        },
        lines: {
          type: "number",
          description: "Number of lines to show. Default 20.",
        },
      },
      required: ["target"],
    },
  },
];



// Tool names that perform destructive operations and require user confirmation
export const DESTRUCTIVE_TOOLS = new Set(["kill_process", "kill_all_dev_ports", "clean_orphaned"]);

