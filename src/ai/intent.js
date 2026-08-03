/**
 * Intent classifier + Input preprocessor + Injection detector (all Local)
 *
 * Classifies user input BEFORE any AI API call:
 *   - "direct_command" — handled locally by the REPL
 *   - "port_query" — valid port/process question, send to AI
 *   - "vague" — ambiguous input, show smart suggestions then send to AI with hints
 *   - "off_topic" — not related to ports/processes, blocked client-side
 *   - "injection_attempt" — prompt injection detected, blocked client-side
 */


// ── Prompt Injection Patterns ───────────────────────────────────────────── //

const INJECTION_PATTERNS = [
  /\b(?:ignore|disregard|forget|override|bypass|skip)\s+(?:\w+\s+)*(?:instructions?|rules?|prompt|guidelines?|constraints?|programming|directives?)/i,
  /\b(?:you are now|from now on you are|act as|pretend (?:to be|you(?:'re| are))|roleplay as|simulate being|behave as if you(?:'re| are)|imagine you(?:'re| are))\b/i,
  /\b(?:enter|enable|activate|switch to|go into)\s+(?:developer|dev|admin|god|sudo|jailbreak|unrestricted|uncensored|DAN)\s*(?:mode)?\b/i,
  /\bDAN\b/,
  /\b(?:new|updated|revised|override)\s+(?:instructions?|system\s*prompt|rules?):/i,

  /\b(?:show|reveal|display|print|output|repeat|echo|tell me|what(?:'s| is| are))\s+(?:\w+\s+)*(?:system\s*prompt|instructions?|rules?|internal\s*(?:prompt|config|instructions?)|hidden\s*(?:prompt|instructions?)|initial\s*(?:prompt|instructions?))/i,
  /\b(?:what were you told|what are your instructions|what is your programming)\b/i,

  // Ignore legitimate creator/developer questions (e.g. "who made you")
  // Focus on prompt extraction:
  /\b(?:who|what|where).*?\b(?:system\s*prompt|instructions?|rules?|internal\s*(?:prompt|config|instructions?)|hidden\s*(?:prompt|instructions?)|initial\s*(?:prompt|instructions?))\b/i,

  /\bjailbreak\b/i,
  /\bdo anything now\b/i,
  /\balways intelligent and machiavellian\b/i,
  /\bunrestricted\s+(?:mode|ai|assistant)\b/i,

  /^(?:system|SYSTEM)\s*:/m,
  /\[(?:SYSTEM|INST|SYS)\]/i,
  /<<\s*(?:SYS|SYSTEM|INSTRUCTIONS?)\s*>>/i,
];


function isInjectionAttempt(input) {
  return INJECTION_PATTERNS.some((re) => re.test(input));
}


// ── Self-Help ─────────────────────────────────────────────────────────────── //

const SELF_HELP_COMMAND_NAMES = [
  "portscope",
  // Slash commands (with or without the leading /)
  "/provider", "/endpoint", "/endpoints", "/revoke", "/models", "/model", "/status", "/usage",
  "/verbose", "/clear", "/history", "/load", "/export", "/help", "/exit",
  "provider", "endpoint", "revoke", "verbose",
  // Direct REPL commands
  "kill", "pause", "resume", "restart", "watch", "inspect", "logs",
  "clean", "ps", "list", "chat",
];

const SELF_HELP_PATTERNS = [
  // "how do I /revoke", "how to revoke my key", "how can I export"
  /\b(?:how|where|can i|could i|do i|what(?:'s| is| does))\b.*\b(?:\/(?:provider|revoke|models?|status|usage|verbose|clear|history|load|export|help|exit)|portscope)\b/i,
  // Questions mentioning api key + revoke/change/delete/remove/update in PortScope context
  /\b(?:revoke|remove|delete|change|update|reset|rotate|set|add|configure|switch|manage)\b.*\b(?:api\s*key|key|provider|model)\b/i,
  /\b(?:api\s*key|key|provider|model)\b.*\b(?:revoke|remove|delete|change|update|reset|rotate|set|add|configure|switch|manage)\b/i,
  // "what commands", "list commands", "available commands/features"
  /\b(?:commands?|features?|options?|capabilities|what can (?:you|portscope))\b/i,
  // "how to use portscope", "portscope help"
  /\bportscope\b/i,
  // Explicit slash-command references (must have the /)
  /\/(?:provider|revoke|models?|status|usage|verbose|clear|history|load|export|help|exit)\b/i,
  // "switch provider", "change model", "set verbose"
  /\b(?:switch|change|set|toggle|enable|disable)\s+(?:provider|model|verbose|streaming)\b/i,
  // "conversation history", "export chat", "clear conversation"
  /\b(?:conversation|chat)\s+(?:history|export|clear|reset|load|save)\b/i,
  /\b(?:history|export|clear|reset|load|save)\s+(?:conversation|chat)\b/i,
  // "token usage", "cost", "usage stats"
  /\b(?:token|usage|cost|billing|spend)\b.*\b(?:stats?|usage|dashboard|check|show|see)\b/i,
];

function isSelfHelp(input) {
  const lower = input.toLowerCase();
  if (SELF_HELP_COMMAND_NAMES.some((cmd) => lower.includes(cmd))) {
    if (/\/\w+/.test(lower)) return true;
    if (/\b(?:how|where|can|could|do|does|what|which|show|help|use|using|explain|tell)\b/i.test(lower)) return true;
  }
  return SELF_HELP_PATTERNS.some((re) => re.test(input));
}


// ── Off-Topic Detection ─────────────────────────────────────────────────── //

/**
 * Keywords that indicate the query is related to PortScope's domain.
 * If NONE of these are present AND the input matches off-topic patterns,
 * we classify as off_topic.
 */
const DOMAIN_KEYWORDS = [
  /\bports?\b/i, /\bpid\b/i, /\bprocess(?:es)?\b/i, /\bkill\b/i, /\bstop\b/i,
  /\blisten(?:ing)?\b/i, /\brunning\b/i, /\bmemory\b/i, /\bcpu\b/i, /\bram\b/i,
  /\blog(?:s|file)?\b/i, /\bserver\b/i, /\bdev\b/i, /\bdocker\b/i, /\bcontainer\b/i,
  /\bnetwork\b/i, /\bconnect(?:ion|ed|s)?\b/i, /\bsocket\b/i, /\btcp\b/i, /\budp\b/i,
  /\bnode\b/i, /\bpython\b/i, /\bflask\b/i, /\bdjango\b/i, /\bnext\.?js\b/i,
  /\bvite\b/i, /\bexpress\b/i, /\breact\b/i, /\bangular\b/i, /\bvue\b/i,
  /\buptime\b/i, /\bzombie\b/i, /\borphan(?:ed)?\b/i, /\bclean\b/i, /\brestart\b/i,
  /\bpause\b/i, /\bresume\b/i, /\bwatch\b/i, /\binspect\b/i, /\bscan\b/i,
  /\bslow\b/i, /\bhang(?:ing)?\b/i, /\bcrash(?:ing|ed)?\b/i, /\berror\b/i,
  /\bfrontend\b/i, /\bbackend\b/i, /\bapi\b/i, /\bmicroservice\b/i,
  /\b(?:3000|5000|8000|8080|4200|5173|3001|80|443|5432|27017|6379)\b/,
  /\bollama\b/i, /\bjupyter\b/i, /\bstreamlit\b/i, /\bmlflow\b/i, /\bgradio\b/i,
  /\bsystem\s*stats\b/i, /\bload\b/i, /\bpressure\b/i, /\bfree\s*(?:up|space)?\b/i,
  /\bwhat(?:'s| is)\s+(?:using|on|hogging|running|consuming|taking)/i,
  /\bwho(?:'s| is)\s+(?:on|using|listening)/i,
  /\bshow\s+(?:me\s+)?(?:ports?|processes?|running|listening|what)/i,
];

const OFF_TOPIC_PATTERNS = [
  /\b(?:write|generate|create)\s+(?:me\s+)?(?:a |an )?(?:poem|story|essay|song|code|script|function|program|class|app)\b/i,
  /\b(?:translate|conversion?)\s+(?:this|the|from|to)\b/i,
  /\b(?:what is the capital|when (?:did|was)|how (?:old|tall|many (?:people|countries)))\b/i,
  /\b(?:tell me (?:a joke|about)|explain (?:quantum|relativity|blockchain|cryptocurrency))\b/i,
  /\b(?:recipe|cook|ingredients|calories)\b/i,
  /\b(?:weather|forecast|temperature) (?:in|for|at|today)\b/i,
  /\b(?:play|sing|draw|paint|compose)\b/i,
  /\b(?:solve|calculate|integral|derivative|equation|math)\b/i,
  /\b(?:summarize|tldr|paraphrase) (?:this|the)\b/i,
  /\b(?:homework|assignment|exam|quiz)\b/i,
];

function hasDomainRelevance(input) {
  return DOMAIN_KEYWORDS.some((re) => re.test(input));
}

function isOffTopic(input) {
  if (hasDomainRelevance(input)) return false;
  return OFF_TOPIC_PATTERNS.some((re) => re.test(input));
}


const GREETING_PATTERNS = [
  /^(?:hi+|hey+|hello|howdy|hiya|yo|sup|heya|greetings)\s*[.!?]*$/i,
];


// ── Vague Input Detection ───────────────────────────────────────────────── //

const VAGUE_PATTERNS = [
  /^(?:hm+|uh+|um+|ok|okay|idk|stuff|things?|hmm+|huh|bruh|lol|wow|cool)\s*[.?!]*$/i,
  /^(?:what(?:'s| is) (?:up|going on|happening)|do something|fix (?:it|this|things?)|make it (?:work|better)|i(?:'m| am) confused)\s*[.?!]*$/i,
  /^(?:anything|everything|nothing|whatever|something|somehow|somewhere|anyone)\s*[.?!]*$/i,
];

function isGreeting(input) {
  return GREETING_PATTERNS.some((re) => re.test(input.trim()));
}

function isVague(input) {
  if (isGreeting(input)) return false;
  return VAGUE_PATTERNS.some((re) => re.test(input.trim()));
}



function generateSuggestions(input) {
  const lower = input.toLowerCase();
  const suggestions = [];

  if (/\b(?:help|what can|how to)\b/.test(lower)) {
    suggestions.push("show all running ports");
    suggestions.push("what's using the most memory?");
    suggestions.push("type 'help' for all commands");
  } else if (/\b(?:slow|lag|hang|stuck)\b/.test(lower)) {
    suggestions.push("which process is using the most CPU?");
    suggestions.push("show system memory pressure");
    suggestions.push("are there any zombie processes?");
  } else if (/\b(?:fix|broken|error|crash)\b/.test(lower)) {
    suggestions.push("show me what's running on port 3000");
    suggestions.push("restart <port> to relaunch a dev server");
    suggestions.push("clean — kill orphaned processes");
  } else {
    suggestions.push("show all running ports");
    suggestions.push("what process is on port 3000?");
    suggestions.push("kill <port> to stop a process");
    suggestions.push("are my ports connected to each other?");
  }

  return suggestions;
}




// Main Classifier
export function classifyIntent(input) {
  if (!input || typeof input !== "string") {
    return { type: "vague", suggestions: generateSuggestions("") };
  }

  const trimmed = input.trim();

  if (isInjectionAttempt(trimmed)) {
    return {
      type: "injection_attempt",
      response: "I am PortScope. I only assist with managing local ports and processes.",
    };
  }

  if (isSelfHelp(trimmed)) {
    return { type: "port_query", normalized: trimmed };
  }

  if (isOffTopic(trimmed)) {
    return {
      type: "off_topic",
      response: "I'm PortScope — I help with ports, processes, and local dev servers. Try asking about running ports, killing processes, or checking system stats.",
      suggestions: generateSuggestions(trimmed),
    };
  }

  if (isGreeting(trimmed)) {
    return { type: "port_query", normalized: trimmed };
  }

  if (isVague(trimmed)) {
    return {
      type: "vague",
      suggestions: generateSuggestions(trimmed),
      normalized: trimmed,
    };
  }

  if (hasDomainRelevance(trimmed)) {
    return { type: "port_query", normalized: trimmed };
  }

  if (trimmed.length < 10) {
    return { type: "port_query", normalized: trimmed };
  }

  return { type: "port_query", normalized: trimmed };
}

export { isInjectionAttempt, isOffTopic, isVague, isSelfHelp, hasDomainRelevance, generateSuggestions };
