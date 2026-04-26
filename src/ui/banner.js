import chalk from "chalk";
import { VERSION } from "../version.js";

const BANNER_LINES = [
  "██████╗  ██████╗ ██████╗ ████████╗███████╗ ██████╗ ██████╗ ██████╗ ███████╗",
  "██╔══██╗██╔═══██╗██╔══██╗╚══██╔══╝██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔════╝",
  "██████╔╝██║   ██║██████╔╝   ██║   ███████╗██║     ██║   ██║██████╔╝█████╗  ",
  "██╔═══╝ ██║   ██║██╔══██╗   ██║   ╚════██║██║     ██║   ██║██╔═══╝ ██╔══╝  ",
  "██║     ╚██████╔╝██║  ██║   ██║   ███████║╚██████╗╚██████╔╝██║     ███████╗",
  "╚═╝      ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝ ╚═════╝ ╚═════╝╚═╝     ╚══════╝",
];

const GRADIENT = [
  [0, 230, 255],
  [0, 200, 255],
  [30, 170, 255],
  [80, 130, 255],
  [120, 100, 255],
  [160, 70, 240],
];


export function renderBanner() {
  const columns = process.stdout.columns || 80;
  console.log();

  if (columns >= 82) {
    for (let i = 0; i < BANNER_LINES.length; i++) {
      const [r, g, b] = GRADIENT[i];
      console.log("  " + chalk.rgb(r, g, b)(BANNER_LINES[i]));
    }

    const tagline = "🔊 listening to your ports";
    const version = `v${VERSION}`;
    const bannerWidth = BANNER_LINES[0].length;
    const pad = bannerWidth - tagline.length - version.length;
    console.log(
      "  " + chalk.gray(tagline) + " ".repeat(Math.max(1, pad)) + chalk.dim(version),
    );
  } else {
    console.log(
      chalk.rgb(0, 200, 255).bold("  🔊 PortScope") + chalk.dim(` v${VERSION}`),
    );
    console.log(chalk.gray("  listening to your ports..."));
  }

  console.log();
}
