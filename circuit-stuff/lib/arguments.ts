// The command line of recognize.ts.

export const DEFAULT_TIMEOUT_SECONDS = 120;

export type Options = {
    paths: string[];
    html: boolean;
    json: boolean;
    sweep: boolean;
    diagram: boolean;
    diagrams: string | null;
    reuse: boolean;
    out: string | null;
    url: string | null;
    timeoutSeconds: number;
};

export const HELP = `Sends photo + recognition JSON pairs to the model API and shows the result.

Usage: bun circuit-stuff/recognize.ts <folder or file>... [options]

  A pair is name.png (or .jpg) + name.json, or the dev page's captured-circuit.png + recognition.json.
  Give pairs, images, JSON files or folders; a folder is searched one level deep.

Options:
  --html          write a report per pair (the image with boxes drawn on it) to the output folder
  --json          also write the raw response (and the merged components, with --sweep) per pair to the output folder
  --sweep         also send a grid of windows over the whole image, and merge what the model says about them
                  with the first pass's boxes (see src/lib/vision/reconcile.ts)
  --diagram       also work out the wiring and write a diagram.json per pair (the final components and their
                  connections, in the shape of Wokwi's diagram.json); PNG images only
  --diagrams DIR  where diagrams go (default: circuit-stuff/diagrams, which git ignores)
  --reuse         use the saved <name>.result.json in the output folder instead of calling the API, so a drawing is not
                  sent again (needs an earlier run with --json, on the same image and options)
  --out DIR       output folder (default: circuit-stuff/results, which git ignores)
  --url URL       model API address (default: HOLOTRACE_MODEL_API_URL)
  --timeout SEC   give up on a request after this long (default ${DEFAULT_TIMEOUT_SECONDS})
  -h, --help      this text

Environment (a .env file in the folder you run from is read by Bun):
  HOLOTRACE_MODEL_API_URL   the model API address, https://... (see reference/model-api-example.md)
  HOLOTRACE_ML_API_KEY      the bearer key; never passed on the command line, never printed
`;

// Prints the message and stops with the "bad usage" exit code.
export function fail(message: string): never {
    console.error(`error: ${message}`);
    process.exit(2);
}

export function parseArguments(argv: string[]): Options {
    const options: Options = { paths: [], html: false, json: false, sweep: false, diagram: false, diagrams: null, reuse: false, out: null, url: null, timeoutSeconds: DEFAULT_TIMEOUT_SECONDS };
    for (let n = 0; n < argv.length; n++) {
        const arg = argv[n];
        const value = () => {
            const next = argv[++n];
            if (next === undefined) fail(`${arg} needs a value`);
            return next;
        };
        if (arg === "-h" || arg === "--help") {
            console.log(HELP);
            process.exit(0);
        } else if (arg === "--html") options.html = true;
        else if (arg === "--json") options.json = true;
        else if (arg === "--sweep") options.sweep = true;
        else if (arg === "--diagram") options.diagram = true;
        else if (arg === "--diagrams") options.diagrams = value();
        else if (arg === "--reuse") options.reuse = true;
        else if (arg === "--out") options.out = value();
        else if (arg === "--url") options.url = value();
        else if (arg === "--timeout") options.timeoutSeconds = Number(value());
        else if (arg.startsWith("-")) fail(`unknown option ${arg}; see --help`);
        else options.paths.push(arg);
    }
    if (options.paths.length === 0) fail("give at least one folder or file; see --help");
    if (!(options.timeoutSeconds > 0)) fail("--timeout must be a positive number of seconds");
    return options;
}
