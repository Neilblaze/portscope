import chalk from "chalk";


const SPIRAL = [0, 1, 2, 5, 8, 7, 6, 3, 4];  // Clockwise spiral

const ACTIVE = chalk.rgb(100, 200, 255)("▪");
const TRAIL = chalk.rgb(60, 120, 160)("▫");
const INACTIVE = chalk.gray("·");
const FRAME_MS = 130;

export const SPINNER_VERBS = [
  "Accomplishing", "Actioning", "Actualizing", "Architecting", "Baking", "Beaming",
  "Beboppin'", "Befuddling", "Billowing", "Blanching", "Bloviating", "Boogieing",
  "Boondoggling", "Booping", "Bootstrapping", "Brewing", "Bunning", "Burrowing",
  "Calculating", "Canoodling", "Caramelizing", "Cascading", "Catapulting", "Cerebrating",
  "Channeling", "Channelling", "Choreographing", "Churning", "Clauding", "Coalescing",
  "Cogitating", "Combobulating", "Composing", "Computing", "Concocting", "Considering",
  "Contemplating", "Cooking", "Crafting", "Creating", "Crunching", "Crystallizing",
  "Cultivating", "Deciphering", "Deliberating", "Determining", "Dilly-dallying",
  "Discombobulating", "Doing", "Doodling", "Drizzling", "Ebbing", "Effecting",
  "Elucidating", "Embellishing", "Enchanting", "Envisioning", "Evaporating", "Fermenting",
  "Fiddle-faddling", "Finagling", "Flambéing", "Flibbertigibbeting", "Flowing",
  "Flummoxing", "Fluttering", "Forging", "Forming", "Frolicking", "Frosting",
  "Gallivanting", "Galloping", "Garnishing", "Generating", "Gesticulating", "Germinating",
  "Gitifying", "Grooving", "Gusting", "Harmonizing", "Hashing", "Hatching", "Herding",
  "Honking", "Hullaballooing", "Hyperspacing", "Ideating", "Imagining", "Improvising",
  "Incubating", "Inferring", "Infusing", "Ionizing", "Jitterbugging", "Julienning",
  "Kneading", "Leavening", "Levitating", "Lollygagging", "Manifesting", "Marinating",
  "Meandering", "Metamorphosing", "Misting", "Moonwalking", "Moseying", "Mulling",
  "Mustering", "Musing", "Nebulizing", "Nesting", "Newspapering", "Noodling",
  "Nucleating", "Orbiting", "Orchestrating", "Osmosing", "Perambulating", "Percolating",
  "Perusing", "Philosophising", "Photosynthesizing", "Pollinating", "Pondering",
  "Pontificating", "Pouncing", "Precipitating", "Prestidigitating", "Processing",
  "Proofing", "Propagating", "Puttering", "Puzzling", "Quantumizing", "Razzle-dazzling",
  "Razzmatazzing", "Recombobulating", "Reticulating", "Roosting", "Ruminating",
  "Sautéing", "Scampering", "Schlepping", "Scurrying", "Seasoning", "Shenaniganing",
  "Shimmying", "Simmering", "Skedaddling", "Sketching", "Slithering", "Smooshing",
  "Sock-hopping", "Spelunking", "Spinning", "Sprouting", "Stewing", "Sublimating",
  "Swirling", "Swooping", "Symbioting", "Synthesizing", "Tempering", "Thinking",
  "Thundering", "Tinkering", "Tomfoolering", "Topsy-turvying", "Transfiguring",
  "Transmuting", "Twisting", "Undulating", "Unfurling", "Unravelling", "Vibing",
  "Waddling", "Wandering", "Warping", "Whatchamacalliting", "Whirlpooling", "Whirring",
  "Whisking", "Wibbling", "Working", "Wrangling", "Zesting", "Zigzagging"
];


/**
 * Start an animated 3×3 dot grid spinner.
 * Returns { stop() } handle to clear the spinner.
 *
 * @param {string} [label] — custom label, or a random one is picked
 */
export function startSpinner(label) {
  if (!process.stdout.isTTY) {
    // Non-TTY: print static text, return no-op stop
    const text = label || `${SPINNER_VERBS[0]}...`;
    process.stdout.write(chalk.gray(`\n  ${text}`));
    return {
      stop() {
        process.stdout.write("\r" + " ".repeat(50) + "\r");
      },
    };
  }

  const displayLabel = label || `${SPINNER_VERBS[Math.floor(Math.random() * SPINNER_VERBS.length)]}...`;
  let frame = 0;
  let rendered = false;

  const render = () => {
    const dots = new Array(9).fill(INACTIVE);
    const currentPos = SPIRAL[frame % 9];
    const prevPos = SPIRAL[(frame - 1 + 9) % 9];
    dots[currentPos] = ACTIVE;
    dots[prevPos] = TRAIL;

    const row1 = `  ${dots[0]}${dots[1]}${dots[2]}`;
    const row2 = `  ${dots[3]}${dots[4]}${dots[5]}  ${chalk.gray(displayLabel)}`;
    const row3 = `  ${dots[6]}${dots[7]}${dots[8]}`;

    if (rendered) {
      process.stdout.write("\x1b[3A\r");
    }

    process.stdout.write(`${row1}\n${row2}\n${row3}\n`);
    rendered = true;
    frame++;
  };

  process.stdout.write("\x1b[?25l");
  process.stdout.write("\n");
  render();
  const interval = setInterval(render, FRAME_MS);

  return {
    stop() {
      clearInterval(interval);
      if (rendered) {
        process.stdout.write("\x1b[4A\r");
        for (let i = 0; i < 4; i++) {
          process.stdout.write("\x1b[2K");
          if (i < 3) process.stdout.write("\n");
        }
        process.stdout.write("\x1b[3A\r");
      }
      process.stdout.write("\x1b[?25h");
    },
  };
}
