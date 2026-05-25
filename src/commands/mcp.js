import express from "express";
import os from "os";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { TOOLS } from "../ai/tools.js";
import { executeTool } from "../ai/executor.js";
import { loadConfig } from "../config/loader.js";
import { getAvailableMemory } from "../scanner/memory.js";
import chalk from "chalk";


export async function mcpCommand(args) {
  await loadConfig();

  const transportArg = args.includes("--transport") ? args[args.indexOf("--transport") + 1] : "stdio";
  const portArgIndex = args.indexOf("--port");

  let port = 3000;
  if (portArgIndex !== -1) {
    port = parseInt(args[portArgIndex + 1], 10);
  } else if (process.env.PORTSCOPE_MCP_PORT) {
    port = parseInt(process.env.PORTSCOPE_MCP_PORT, 10);
  }

  const server = new Server(
    {
      name: "portscope-mcp",
      version: "1.7.0",
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
        resources: {}
      },
    }
  );

  // Tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.parameters,
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: toolArgs } = request.params;
    try {
      const result = await executeTool(name, toolArgs, null, { headless: true });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error executing tool: ${err.message}` }],
        isError: true,
      };
    }
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [
        {
          name: "portscope-help",
          description: "Usage examples and guidelines for PortScope MCP",
        }
      ]
    };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    if (request.params.name === "portscope-help") {
      return {
        description: "PortScope usage examples",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Here are some usage examples for PortScope:
                      1. To see all ports: use list_ports()
                      2. To see only dev servers: use list_ports() with all=false
                      3. To kill a specific process: use kill_process({ targets: [3000] })
                      4. To check system stats when things are slow: use get_system_stats()`
            }
          }
        ]
      };
    }
    throw new Error("Prompt not found");
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: "portscope://status",
          name: "Server Status",
          mimeType: "application/json",
          description: "Real-time health metrics of the PortScope MCP server"
        }
      ]
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    if (request.params.uri === "portscope://status") {
      const totalMem = os.totalmem();
      const freeMem = getAvailableMemory();
      return {
        contents: [
          {
            uri: "portscope://status",
            mimeType: "application/json",
            text: JSON.stringify({
              status: "online",
              uptimeSeconds: process.uptime(),
              memory: {
                totalGB: (totalMem / 1024 ** 3).toFixed(2),
                usedGB: ((totalMem - freeMem) / 1024 ** 3).toFixed(2)
              }
            }, null, 2)
          }
        ]
      };
    }
    throw new Error("Resource not found");
  });


  if (transportArg === "sse") {
    const app = express();
    let transport;

    app.get("/sse", async (req, res) => {
      transport = new SSEServerTransport("/message", res);
      await server.connect(transport);
    });

    app.post("/message", express.json(), async (req, res) => {
      if (transport) {
        await transport.handlePostMessage(req, res);
      } else {
        res.status(500).send("No active SSE connection");
      }
    });

    app.listen(port, () => {
      console.log(chalk.cyan(`\n  [PortScope MCP]`));
      console.log(`  SSE Server running at: ${chalk.green(`http://localhost:${port}/sse`)}`);
      console.log(`  Message endpoint:      ${chalk.green(`http://localhost:${port}/message`)}\n`);
    });
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
}
