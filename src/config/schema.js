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
  gemini: {
    model: "gemini-2.5-flash",
    envKey: "GEMINI_API_KEY",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    modelsUrl: null,
    label: "Google Gemini",
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
  cerebras: {
    model: "llama-4-scout-17b-16e-instruct",
    envKey: "CEREBRAS_API_KEY",
    baseUrl: "https://api.cerebras.ai/v1/chat/completions",
    modelsUrl: "https://api.cerebras.ai/v1/models",
    label: "Cerebras",
  },
  groq: {
    model: "llama-3.3-70b-versatile",
    envKey: "GROQ_API_KEY",
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    modelsUrl: "https://api.groq.com/openai/v1/models",
    label: "Groq",
  },
  ollama: {
    model: "llama3",
    envKey: null,
    baseUrl: "http://localhost:11434/api/chat",
    modelsUrl: "http://localhost:11434/api/tags",
    label: "Ollama (Local)",
  },
};


export const PROVIDER_IDS = ["anthropic", "openai", "gemini", "openrouter", "nvidia", "cerebras", "groq", "ollama"];

