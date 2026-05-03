import chalk from "chalk";
import stringWidth from "string-width";


export const ICONS = {
  healthy: chalk.green("●"),
  orphaned: chalk.yellow("●"),
  zombie: chalk.red("●"),
  unknown: chalk.gray("●"),
};

export const FRAMEWORK_COLORS = {
  "Next.js": chalk.white.bgBlack,
  Vite: chalk.yellow,
  React: chalk.cyan,
  Vue: chalk.green,
  Angular: chalk.red,
  Svelte: chalk.rgb(255, 62, 0),
  SvelteKit: chalk.rgb(255, 62, 0),
  Express: chalk.gray,
  Fastify: chalk.white,
  NestJS: chalk.red,
  Nuxt: chalk.green,
  Remix: chalk.blue,
  Astro: chalk.magenta,
  Django: chalk.green,
  Flask: chalk.white,
  FastAPI: chalk.cyan,
  Rails: chalk.red,
  Gatsby: chalk.magenta,
  Go: chalk.cyan,
  Rust: chalk.rgb(222, 165, 93),
  Ruby: chalk.red,
  Python: chalk.yellow,
  "Node.js": chalk.green,
  Java: chalk.red,
  Hono: chalk.rgb(255, 102, 0),
  Koa: chalk.white,
  Webpack: chalk.blue,
  esbuild: chalk.yellow,
  Parcel: chalk.rgb(224, 178, 77),
  Docker: chalk.blue,
  PostgreSQL: chalk.blue,
  Redis: chalk.red,
  MySQL: chalk.blue,
  MongoDB: chalk.green,
  nginx: chalk.green,
  LocalStack: chalk.white,
  RabbitMQ: chalk.rgb(255, 102, 0),
  Kafka: chalk.white,
  Elasticsearch: chalk.yellow,
  MinIO: chalk.red,
};

/**
 * Format framework name with color
 */
export function formatFramework(framework) {
  if (!framework) return chalk.gray("—");
  const colorFn = FRAMEWORK_COLORS[framework] || chalk.white;
  return colorFn(framework);
}



export function formatStatus(status) {
  const icon = ICONS[status] || ICONS.unknown;
  const labels = {
    healthy: chalk.green("healthy"),
    orphaned: chalk.yellow("orphaned"),
    zombie: chalk.red("zombie"),
    unknown: chalk.gray("unknown"),
  };
  return `${icon} ${labels[status] || labels.unknown}`;
}

export function formatEnvironment(env) {
  if (!env || env === "unknown") return chalk.gray("—");
  if (env === "development") return chalk.green("dev");
  if (env === "production") return chalk.yellow("prod");
  if (env === "test") return chalk.blue("test");
  if (env === "staging") return chalk.magenta("stage");
  return chalk.gray(env.slice(0, 5));
}

export function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

export function padToWidth(text, targetWidth) {
  const actual = stringWidth(text);
  return text + " ".repeat(Math.max(0, targetWidth - actual));
}
