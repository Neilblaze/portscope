import chalk from "chalk";
import readline from "readline";
import { VERSION } from "../version.js";

const BANNER_LINES = [
  " ██████╗  ██████╗ ██████╗ ████████╗███████╗ ██████╗ ██████╗ ██████╗ ███████╗",
  " ██╔══██╗██╔═══██╗██╔══██╗╚══██╔══╝██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔════╝",
  " ██████╔╝██║   ██║██████╔╝   ██║   ███████╗██║     ██║   ██║██████╔╝█████╗  ",
  " ██╔═══╝ ██║   ██║██╔══██╗   ██║   ╚════██║██║     ██║   ██║██╔═══╝ ██╔══╝  ",
  " ██║     ╚██████╔╝██║  ██║   ██║   ███████║╚██████╗╚██████╔╝██║     ███████╗",
  " ╚═╝      ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝ ╚═════╝ ╚═════╝ ╚═╝     ╚══════╝",
];

const GRADIENT = [
  [0, 230, 255],
  [0, 200, 255],
  [30, 170, 255],
  [80, 130, 255],
  [120, 100, 255],
  [160, 70, 240],
];


let hasAnimated = false;

const GLITCH_CHARS = "01!@#$%^&*~<>?/-_=+\\|[]{}";
function glitchText(text) {
  return text.split('').map(c => {
    if (c === ' ') return c;
    return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
  }).join('');
}

export async function renderBanner() {
  const columns = process.stdout.columns || 80;
  console.log();

  if (columns >= 82) {
    if (!hasAnimated && process.stdout.isTTY) {
      for (let i = 0; i < BANNER_LINES.length; i++) {
        console.log();
      }

      const totalFrames = BANNER_LINES.length + 3;
      for (let frame = 0; frame <= totalFrames; frame++) {
        readline.moveCursor(process.stdout, 0, -BANNER_LINES.length);
        for (let j = 0; j < BANNER_LINES.length; j++) {
          const [r, g, b] = GRADIENT[j];
          let lineText = BANNER_LINES[j];

          const resolvedLines = frame - 3;
          if (j >= resolvedLines) {
            lineText = glitchText(lineText);
          }
          readline.clearLine(process.stdout, 0);
          readline.cursorTo(process.stdout, 0);
          process.stdout.write("  " + chalk.rgb(r, g, b)(lineText) + "\n");
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    } else {
      for (let i = 0; i < BANNER_LINES.length; i++) {
        const [r, g, b] = GRADIENT[i];
        console.log("  " + chalk.rgb(r, g, b)(BANNER_LINES[i]));
      }
    }
    hasAnimated = true;

    const tagline = " 🔊 listening to your ports";
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
