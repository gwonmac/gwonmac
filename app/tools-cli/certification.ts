/**
 * `pnpm certification <subcommand>`: the one command line over the
 * official-client -> template-save -> Enhancement chain.
 *
 * It owns argument parsing, printing and exit codes, and nothing else. Every
 * answer comes from the modules `app/client/certification/` owns, so a report
 * printed here and the decision a launch makes cannot disagree — and the four
 * separate commands this replaced cannot drift apart in how they locate the
 * installed client or spell a failure.
 *
 * `template --write` is the one subcommand that changes a tracked file. It is
 * a manual developer tool; automation must never call it or treat its output
 * as launch authority. It refuses every case but a new structurally derived
 * build — including one already certified.
 * It never touches `ENHANCEMENT_BUILDS`: those layout words are client-memory
 * addresses no structural anchor re-derives, so nothing may add them without a
 * person measuring them.
 *
 * Machine-readable output goes to stdout and human findings go to stderr, so a
 * caller can pipe one without losing the other. A misuse exits 2 and a refusal
 * the chain itself made exits 1, uniformly across every subcommand; only a
 * transform that refuses its input throws, because the hash it names is the
 * finding.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, open } from "node:fs/promises";
import path from "node:path";
import { writeAtomic } from "../main/core/atomic-file.js";
import {
  enhancementOutputSha256,
  findEnhancementBuild,
} from "../client/certification/enhancement-builds.js";
import { transformEnhancementWasm } from "../client/certification/enhancement-transform.js";
import {
  ENHANCEMENT_CAPABILITY_PRESETS,
  ENHANCEMENT_TRANSFORM_ABI,
} from "../shared/enhancement-contracts.js";
import {
  currentMessageAnchors,
  recertifyEnhancementBytes,
} from "./enhancement-recert.js";
import {
  defaultGuildWarsProfile,
  inspectEnhancementWorkspace,
} from "./enhancement-workspace.js";
import {
  formatBuildEntry,
  insertBuildEntry,
  inspectTemplateSaveCandidate,
  TEMPLATE_SAVE_TABLE,
} from "./template-save-recert.js";
import {
  cartographyReport,
  doubleClickReport,
  QUALIFICATION_CHECKS,
  qualifyClient,
  runtimePredecessors,
  runtimeReport,
} from "./client-qualification.js";
import { formatWatchReport } from "./watch-report.js";

import { inspectWasmBytes } from "./wasm-inspection.js";

const USAGE =
  "usage: pnpm certification <command>\n"
  + "  inspect [PATH/Gw.jspi.wasm]          inventory local bytes; no runtime authority\n"
  + "  doctor [--profile PATH]              why Enhancement is or is not running here\n"
  + "  recertify [PATH/Gw.jspi.wasm]        draft an Enhancement build entry, with evidence\n"
  + "  verify [PATH/Gw.jspi.wasm]           run the exact runtime feature verifier\n"
  + "  qualify WASM JS OUTPUT_DIR           run the release battery on one exact client\n"
  + "  watch-report GENERATION.json         render the client-watch issue table\n"
  + "  template [PATH/Gw.jspi.wasm] [--emit-ts] [--write] [--expect-certified]\n"
  + "                                       re-derive the template-save build entry\n"
  + "  transform INPUT.wasm OUTPUT.wasm     write the derived Enhancement module\n"
  + "  double-click [PATH/Gw.jspi.wasm]     prove the native double-click route\n"
  + "  cartography [PATH/Gw.jspi.wasm]      prove every Cartography runtime input\n";

/**
 * The one fixed profile the command line emits. The other certified profiles
 * are selected through the application path that owns their cache identity,
 * and reproducing that selection here would be a second place where a
 * capability set decides which output is correct.
 */
const FOUNDATION_CAPABILITIES = ENHANCEMENT_CAPABILITY_PRESETS.cursorParty;

function installedClientArtifact(): string {
  return path.join(
    defaultGuildWarsProfile(),
    "game",
    "artifacts",
    "Gw.jspi.wasm",
  );
}

function argumentValue(argv: readonly string[], name: string): string | null {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] ?? null : null;
}

function positionalArguments(argv: readonly string[]): string[] {
  return argv.filter((argument) => !argument.startsWith("--"));
}

/** Inventory bytes without executing client code or guessing their origin. */
async function inspect(argv: readonly string[]): Promise<void> {
  const refuse = (reason: string, exitCode = 1) => {
    process.stdout.write(`${JSON.stringify({ formatVersion: 1, status: "refused", runtimeAuthority: false, reason })}\n`);
    process.exitCode = exitCode;
  };
  if (argv.length > 1 || argv.some((arg) => arg.startsWith("--"))) {
    refuse("usage: pnpm certification inspect [PATH/Gw.jspi.wasm]", 2);
    return;
  }
  // Bound file allocation even if a supplied file grows after stat. The input
  // is only evidence; no path or hash implies official or synthetic provenance.
  const maximumBytes = 64 * 1024 * 1024;
  let bytes: Uint8Array;
  try {
    const file = await open(argv[0] ?? installedClientArtifact(), "r");
    try {
      const stat = await file.stat();
      if (!stat.isFile()) { refuse("cannot-read"); return; }
      if (stat.size > maximumBytes) { refuse("input-too-large"); return; }
      const buffer = Buffer.alloc(stat.size + 1);
      let length = 0;
      while (length < buffer.length) {
        const read = await file.read(buffer, length, buffer.length - length, length);
        if (read.bytesRead === 0) break;
        length += read.bytesRead;
      }
      if (length !== stat.size) { refuse("input-changed"); return; }
      bytes = new Uint8Array(buffer.subarray(0, length));
    } finally { await file.close(); }
  } catch { refuse("cannot-read"); return; }
  try {
    const module = inspectWasmBytes(bytes);
    if (module === null) { refuse("invalid-wasm"); return; }
    process.stdout.write(`${JSON.stringify({
      formatVersion: 1, status: "ok", runtimeAuthority: false,
      artifact: {
        selection: argv[0] === undefined ? "cached-client-path" : "supplied-path",
        provenance: "unverified",
        sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.byteLength,
      },
      module,
    })}\n`);
  } catch { refuse("unsupported-module-shape"); }
}

async function doctor(argv: readonly string[]): Promise<void> {
  const profile = argumentValue(argv, "--profile") ?? defaultGuildWarsProfile();
  const report = await inspectEnhancementWorkspace(profile);
  process.stdout.write(`${JSON.stringify(report)}\n`);
  if (!report.readyForCachedLive) process.exitCode = 1;
}

async function recertify(argv: readonly string[]): Promise<void> {
  const positional = positionalArguments(argv);
  if (positional.length > 1) {
    process.stderr.write(USAGE);
    process.exitCode = 2;
    return;
  }
  const official = await readFile(positional[0] ?? installedClientArtifact());
  const report = recertifyEnhancementBytes(official, currentMessageAnchors());
  process.stdout.write(`${JSON.stringify(report)}\n`);
  if (!report.candidateInspected) process.exitCode = 2;
}

async function verify(argv: readonly string[]): Promise<void> {
  const positional = positionalArguments(argv);
  if (positional.length > 1) {
    process.stderr.write(USAGE);
    process.exitCode = 2;
    return;
  }
  const { report, proved } = runtimeReport(new Uint8Array(
    await readFile(positional[0] ?? installedClientArtifact()),
  ));
  process.stdout.write(`${JSON.stringify(report)}\n`);
  if (!proved) process.exitCode = 1;
}

/**
 * The release battery: every check once, in one process. Each check's evidence
 * record goes to OUTPUT_DIR as `<check>.json`; the runtime record is
 * `runtime-verdicts.json`. Exits 1 when any check refused.
 */
async function qualify(argv: readonly string[]): Promise<void> {
  const [wasmPath, jsPath, outputDirectory, ...extra] = positionalArguments(argv);
  if (!wasmPath || !jsPath || !outputDirectory || extra.length > 0) {
    process.stderr.write(USAGE);
    process.exitCode = 2;
    return;
  }
  const records = await qualifyClient(wasmPath, jsPath);
  const directory = path.resolve(outputDirectory);
  await mkdir(directory, { recursive: true });
  for (const check of QUALIFICATION_CHECKS) {
    const name = check === "runtime" ? "runtime-verdicts" : check;
    await writeAtomic(
      path.join(directory, `${name}.json`),
      `${JSON.stringify(records[check], null, 2)}\n`,
    );
    process.stderr.write(`qualify ${check}: ${records[check].status}\n`);
  }
  if (QUALIFICATION_CHECKS.some((check) => records[check].status !== "proved")) {
    process.exitCode = 1;
  }
}

async function watchReport(argv: readonly string[]): Promise<void> {
  const [filename, ...extra] = positionalArguments(argv);
  if (!filename || extra.length > 0) {
    process.stderr.write(USAGE);
    process.exitCode = 2;
    return;
  }
  const generation: unknown = JSON.parse(await readFile(filename, "utf8"));
  process.stdout.write(formatWatchReport(generation));
}

async function template(argv: readonly string[]): Promise<void> {
  const emitTypeScript = argv.includes("--emit-ts");
  const writeEntry = argv.includes("--write");
  const expectCertified = argv.includes("--expect-certified");
  const positional = positionalArguments(argv);
  if (positional.length > 1) {
    process.stderr.write(USAGE);
    process.exitCode = 2;
    return;
  }

  const filename = positional[0] ?? installedClientArtifact();
  let input: Uint8Array;
  try {
    input = await readFile(filename);
  } catch {
    process.stderr.write(`certification template: cannot read ${filename}\n`);
    process.stderr.write(USAGE);
    process.exitCode = 2;
    return;
  }

  const report = inspectTemplateSaveCandidate(input);
  process.stdout.write(`${JSON.stringify(report)}\n`);

  // Paste-ready entry goes to stderr so stdout stays machine-parseable. The
  // 23-byte delete-file body is the one value nobody should retype by hand: a
  // wrong byte fails as "not the expected stub", which reads exactly like the
  // build having genuinely changed.
  if (emitTypeScript && report.entry) {
    process.stderr.write(`\n${formatBuildEntry(report.entry)}\n`);
  }

  if (report.status === "failed") {
    process.exitCode = 1;
    return;
  }

  // `--write` edits the authoring source, so it refuses everything except the
  // one case it was written for: a structurally derived entry for a build the
  // table does not list. An already-certified build is not a smaller version
  // of that case — it is the answer "nothing to do", and writing anything
  // would produce a branch whose diff nobody asked for.
  if (writeEntry) {
    if (!report.entry || report.certified) {
      process.stderr.write(
        `certification template --write: nothing to add for ${report.sha256}\n`,
      );
      process.exitCode = 1;
      return;
    }
    const table = path.resolve(TEMPLATE_SAVE_TABLE);
    await writeAtomic(
      table,
      insertBuildEntry(await readFile(table, "utf8"), report.entry),
    );
    process.stderr.write(`certification template: added ${report.sha256} to ${TEMPLATE_SAVE_TABLE}\n`);
  }
  if (expectCertified && report.matchesCertifiedEntry !== true) {
    process.stderr.write(
      "certification template: derived entry does not match the certified one\n",
    );
    process.exitCode = 1;
  }
}

async function transform(argv: readonly string[]): Promise<void> {
  const [inputPath, outputPath] = positionalArguments(argv);
  if (!inputPath || !outputPath) {
    process.stderr.write(USAGE);
    process.exitCode = 2;
    return;
  }

  const input = await readFile(inputPath);
  const sha256 = createHash("sha256").update(input).digest("hex");
  const build = findEnhancementBuild(sha256);
  if (!build) throw new Error(`unsupported official WASM hash ${sha256}`);

  const output = transformEnhancementWasm(
    input,
    build,
    FOUNDATION_CAPABILITIES,
  );
  const outputSha256 = createHash("sha256").update(output).digest("hex");
  if (outputSha256 !== enhancementOutputSha256(build, FOUNDATION_CAPABILITIES)) {
    throw new Error(`uncertified foundation output ${outputSha256}`);
  }
  await writeAtomic(path.resolve(outputPath), output);
  process.stdout.write(`${JSON.stringify({
    buildId: build.buildId,
    inputSha256: sha256,
    transformAbi: ENHANCEMENT_TRANSFORM_ABI,
    inputBytes: input.byteLength,
    outputBytes: output.byteLength,
    outputSha256,
    output: path.resolve(outputPath),
  })}\n`);
}

/** Proves the native double-click route against each output of the whole chain. */
async function doubleClick(argv: readonly string[]): Promise<void> {
  const [filename] = positionalArguments(argv);
  const official = new Uint8Array(
    await readFile(filename ?? installedClientArtifact()),
  );
  const { officialSha256, predecessors } = runtimePredecessors(official);
  const { report, proved } = doubleClickReport(officialSha256, predecessors);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!proved) {
    process.stderr.write(
      "certification double-click: complete native input route did not prove\n",
    );
    process.exitCode = 1;
  }
}

/** Proves Cartography against every predecessor the release can serve. */
async function cartography(argv: readonly string[]): Promise<void> {
  const [filename] = positionalArguments(argv);
  const official = new Uint8Array(
    await readFile(filename ?? installedClientArtifact()),
  );
  const { officialSha256, predecessors } = runtimePredecessors(official);
  const { report, proved } = cartographyReport(officialSha256, predecessors);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!proved) {
    process.stderr.write(
      "certification cartography: one or more runtime inputs did not prove\n",
    );
    process.exitCode = 1;
  }
}

const COMMANDS = Object.freeze({
  inspect,
  doctor,
  recertify,
  verify,
  qualify,
  "watch-report": watchReport,
  template,
  transform,
  "double-click": doubleClick,
  cartography,
});

// The subcommand name is argv, so the lookup has to be closed over own
// properties: a plain object answers for its prototype, which made
// `certification toString` exit 0 having done nothing and `certification
// hasOwnProperty` die with a stack trace instead of printing usage.
function isCommand(value: string): value is keyof typeof COMMANDS {
  return Object.hasOwn(COMMANDS, value);
}

const [name, ...argv] = process.argv.slice(2).filter((value) => value !== "--");
if (name === undefined || !isCommand(name)) {
  process.stderr.write(USAGE);
  process.exitCode = 2;
} else {
  await COMMANDS[name](argv);
}
