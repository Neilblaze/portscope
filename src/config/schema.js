export const DEFAULT_CONFIG = {
  ai: {
    provider: "anthropic",
    model: null,
    maxTokens: 4096,
  },
  display: {
    showBanner: true,
  },
};


export const PROVIDER_DEFAULTS = {
  anthropic: {
    model: "claude-haiku-4-5",
    envKey: "ANTHROPIC_API_KEY",
    baseUrl: "https://api.anthropic.com/v1/messages",
    modelsUrl: null,
    label: "Anthropic",
  },
  openai: {
    model: "gpt-5-nano",
    envKey: "OPENAI_API_KEY",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    modelsUrl: null,
    label: "OpenAI",
  },
  openrouter: {
    model: "qwen/qwen3.5-flash-02-23",
    envKey: "OPENROUTER_API_KEY",
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    modelsUrl: "https://openrouter.ai/api/v1/models",
    label: "OpenRouter",
  },
  nvidia: {
    model: "deepseek-ai/deepseek-v4-flash",
    envKey: "NVIDIA_API_KEY",
    baseUrl: "https://integrate.api.nvidia.com/v1/chat/completions",
    modelsUrl: "https://integrate.api.nvidia.com/v1/models",
    label: "NVIDIA NIM",
  },
};


export const PROVIDER_IDS = ["anthropic", "openai", "openrouter", "nvidia"];

