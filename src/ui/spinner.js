import chalk from "chalk";


const BRAILLE_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const ACTIVE_COLOR = chalk.rgb(100, 255, 136);
const FRAME_MS = 100;

function getShimmerText(text, frame) {
  const cycleLength = text.length + 15;
  const pos = frame % cycleLength;

  let result = "";
  for (let i = 0; i < text.length; i++) {
    const dist = Math.abs(pos - i);
    if (dist === 0) {
      result += chalk.white.bold(text[i]);
    } else if (dist === 1) {
      result += chalk.gray.bold(text[i]);
    } else if (dist === 2) {
      result += chalk.gray(text[i]);
    } else {
      result += chalk.gray.dim(text[i]);
    }
  }
  return result;
}

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
 * Start an animated braille spinner.
 * Returns { stop() } handle to clear the spinner.
 *
 * @param {string} [label] — custom label, or a random one is picked
 */
export function startSpinner(label) {
  if (!process.stdout.isTTY) {
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
    const frameChar = ACTIVE_COLOR(BRAILLE_FRAMES[frame % BRAILLE_FRAMES.length]);
    const shimmerLabel = getShimmerText(displayLabel, frame);
    const row = `  ${frameChar}  ${shimmerLabel}`;

    if (rendered) {
      process.stdout.write("\x1b[1A\r");
    }

    process.stdout.write(`${row}\n`);
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
        process.stdout.write("\x1b[2A\r");
        for (let i = 0; i < 2; i++) {
          process.stdout.write("\x1b[2K");
          if (i < 1) process.stdout.write("\n");
        }
        process.stdout.write("\x1b[1A\r");
      }
      process.stdout.write("\x1b[?25h");
    },
  };
}
