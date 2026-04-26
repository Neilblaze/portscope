import chalk from "chalk";
import { loadConfig, getApiKey } from "../config/loader.js";
import { startChat } from "../ai/conversation.js";

export async function chatCommand() {
  const config = await loadConfig();
  const apiKey = getApiKey(config);

  await startChat(config, apiKey);
}
