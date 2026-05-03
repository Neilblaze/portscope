import chalk from "chalk";
import { createInterface } from "readline";


const ANSI = {
  SAVE_CURSOR: "\x1b[s",
  RESTORE_CURSOR: "\x1b[u",
  CLEAR_LINE_RIGHT: "\x1b[0K",
  MOVE_LEFT: (n) => `\x1b[${n}D`,
  MOVE_RIGHT: (n) => `\x1b[${n}C`,
};

const SLASH_COMMANDS = [
  { name: "/provider", desc: "Switch AI provider & add API key" },
  { name: "/models", desc: "Browse and select a model" },
  { name: "/model", desc: "Set model directly", args: "<name>" },
  { name: "/status", desc: "Show current provider & model" },
  { name: "/usage", desc: "Show token usage & estimated cost" },
  { name: "/clear", desc: "Reset conversation history" },
  { name: "/history", desc: "List previous conversations", args: "[n]" },
  { name: "/load", desc: "Restore a previous conversation", args: "<n>" },
  { name: "/export", desc: "Export conversation", args: "[md|html|txt]" },
  { name: "/help", desc: "Show all commands" },
  { name: "/exit", desc: "Quit PortScope" },
];

const DIRECT_COMMANDS = [
  { name: "kill", desc: "Kill process by port/PID", args: "<port|pid|range|all>" },
  { name: "pause", desc: "Suspend a process (SIGSTOP)", args: "<port|pid>" },
  { name: "resume", desc: "Resume a paused process (SIGCONT)", args: "<port|pid>" },
  { name: "ps", desc: "Show running dev processes", args: "[--all]" },
  { name: "list", desc: "Refresh port table", args: "[--all]" },
  { name: "ports", desc: "Refresh port table", args: "[--all]" },
  { name: "logs", desc: "Tail log output", args: "<port> [-f] [--lines N] [--err]" },
  { name: "clean", desc: "Kill orphaned/zombie servers" },
  { name: "watch", desc: "Monitor port changes in real-time" },
  { name: "inspect", desc: "Inspect a specific port", args: "<port>" },
  { name: "help", desc: "Show all commands" },
  { name: "exit", desc: "Quit PortScope" },
  { name: "quit", desc: "Quit PortScope" },
];

/**
 * Find the best matching suggestion for the current input
 * 
 * @param {string} input - Current user input
 * @returns {string|null} - Suggested completion or null
 */
export function findSuggestion(input) {
  if (!input || input.length === 0 || input.trim().length === 0) {
    return null;
  }

  if (input.endsWith(" ")) {
    return null;
  }

  const trimmed = input.trimStart();

  if (trimmed.startsWith("/")) {
    const parts = trimmed.split(/\s+/);
    const command = parts[0];

    const match = SLASH_COMMANDS.find((cmd) => 
      cmd.name.startsWith(command) && cmd.name !== command
    );

    if (match) {
      const completion = match.name.slice(command.length);
      if (parts.length === 1 && match.args) {
        return completion + " " + match.args;
      }
      return completion;
    }

    return null;
  }

  const parts = trimmed.split(/\s+/);
  const command = parts[0].toLowerCase();

  if (/^\d{1,5}$/.test(command) && parts.length === 1) {
    return null;
  }

  const matches = DIRECT_COMMANDS.filter((cmd) => 
    cmd.name.startsWith(command) && cmd.name !== command
  ).sort((a, b) => a.name.length - b.name.length);

  const match = matches[0];

  if (match) {
    const completion = match.name.slice(command.length);
    if (parts.length === 1 && match.args) {
      return completion + " " + match.args;
    }
    return completion;
  }

  if (parts.length >= 2) {
    const cmd = parts[0].toLowerCase();
    const lastArg = parts[parts.length - 1].toLowerCase();

    if (cmd === "kill" && "all".startsWith(lastArg) && lastArg !== "all" && parts.length === 2) {
      return "all".slice(lastArg.length);
    }

    if ((cmd === "ps" || cmd === "list" || cmd === "ports") && 
        "--all".startsWith(lastArg) && lastArg !== "--all" && parts.length === 2) {
      return "--all".slice(lastArg.length);
    }

    if (cmd === "logs" && parts.length >= 2) {
      const portArg = parts[1];
      if (/^\d+$/.test(portArg) && parts.length === 3) {
        const flag = lastArg;
        if ("-f".startsWith(flag) && flag !== "-f") {
          return "-f".slice(flag.length);
        }
        if ("--lines".startsWith(flag) && flag !== "--lines") {
          return "--lines".slice(flag.length);
        }
        if ("--err".startsWith(flag) && flag !== "--err") {
          return "--err".slice(flag.length);
        }
      }
    }
  }

  return null;
}


/**
 * Render ghost text suggestion at the current cursor position
 * 
 * @param {string} suggestion - The text to display as ghost text
 * @param {import('stream').Writable} output - Output stream (usually process.stdout)
 */
export function renderGhostText(suggestion, output = process.stdout) {
  if (!suggestion) {
    return;
  }

  const ghostText = chalk.dim.gray(suggestion);
  output.write(ANSI.SAVE_CURSOR + ghostText + ANSI.RESTORE_CURSOR);
}


export function clearGhostText(output = process.stdout) {
  output.write(ANSI.SAVE_CURSOR + ANSI.CLEAR_LINE_RIGHT + ANSI.RESTORE_CURSOR);
}

// Accept the current ghost text suggestion (move cursor to end)
export function acceptSuggestion(currentInput, suggestion) {
  if (!suggestion) {
    return currentInput;
  }
  return currentInput + suggestion;
}


export function createGhostTextInterface(options) {
  const rl = createInterface({
    input: options.input,
    output: options.output,
    completer: options.completer,
    terminal: true,
  });

  let currentSuggestion = null;
  let lastInput = "";

  const originalWrite = rl._writeToOutput;
  
  rl._writeToOutput = function (stringToWrite) {
    if (currentSuggestion) {
      clearGhostText(options.output);
      currentSuggestion = null;
    }

    originalWrite.call(this, stringToWrite);

    const line = rl.line || "";

    if (!line || line.endsWith(" ")) {
      lastInput = line;
      return;
    }

    const suggestion = findSuggestion(line);
    if (suggestion && suggestion !== currentSuggestion) {
      currentSuggestion = suggestion;
      renderGhostText(suggestion, options.output);
    } else if (!suggestion && currentSuggestion) {
      currentSuggestion = null;
    }

    lastInput = line;
  };

  // NOTE: Handle right arrow key to accept suggestion
  const originalOnKeypress = rl._onKeypress;
  rl._onKeypress = function (s, key) {
    if (key && key.name === "right" && currentSuggestion) {
      const cursorAtEnd = rl.cursor === rl.line.length;
      
      if (cursorAtEnd) {
        clearGhostText(options.output);
        rl.write(currentSuggestion);
        currentSuggestion = null;
        return;
      }
    }

    if (key && key.ctrl && key.name === "e" && currentSuggestion) {
      clearGhostText(options.output);
      rl.write(currentSuggestion);
      currentSuggestion = null;
      return;
    }

    if (originalOnKeypress) {
      originalOnKeypress.call(this, s, key);
    }
  };

  const originalClose = rl.close.bind(rl);
  rl.close = function () {
    if (currentSuggestion) {
      clearGhostText(options.output);
    }
    originalClose();
  };

  return rl;
}


export function getAllCommands() {
  return {
    slashCommands: SLASH_COMMANDS,
    directCommands: DIRECT_COMMANDS,
  };
}
