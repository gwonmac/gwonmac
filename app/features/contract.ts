/**
 * The feature contract checks that TypeScript cannot make: the id matches its folder,
 * a feature has one switch (or follows the features it requires) and a tool has its own, a card's switch takes the
 * feature's name and summary while every other setting names itself, one shot file per caption, README.md stays inside the
 * small Markdown subset the launcher renders, CHANGELOG.md has `## Unreleased`, every card
 * names a presence, `requires` has no cycles, `uses` names only capabilities and stages the
 * verifier knows, a folder that imports a certified stage's contract names that stage in `uses`
 * (so a refused stage turns the Feature off with a reason), every link names a Feature that
 * offers the methods it calls, FEATURES lists each id once, `parts` and the part files agree in
 * both directions (checkParts), and a Feature with a switch of its own says in its README's
 * `### Details` where to turn it on, and a staged option (`stage`) is a boolean that is not the switch, so
 * it reads as off where the build does not show it, and its README does not name it yet. Pure: the caller reads the folders
 * (tests/policy/feature-contract.test.ts runs it in `pnpm check`), so the same check can run on
 * a scaffold (tests/policy/new-feature-scaffold.test.ts) or a planted error.
 * Each message names the file and says what to change.
 */
import { STAGE_USES, type StageUse } from "../shared/contracts.js";
import { ENHANCEMENT_CAPABILITY_FIELDS } from "../shared/enhancement-contracts.js";
import type { SettingSpec } from "../shared/settings/define.js";
import type { FeatureDefinition, FeaturePartKind } from "./define.js";

/** One app/features/<folder>/ as the caller found it. */
export type FeatureFolder = Readonly<{
  folder: string;
  /** The default export of its feature.ts. */
  manifest: FeatureDefinition;
  /** Every file under the folder, relative to it with `/` separators ("media/shot-1.webp"). */
  files: readonly string[];
  /** README.md and CHANGELOG.md, or null when missing. */
  readme: string | null;
  changelog: string | null;
  /** The repository modules its files import, as repository paths ("app/shared/contracts.ts"). */
  imports: readonly string[];
}>;

export type FeatureContractInput = Readonly<{
  folders: readonly FeatureFolder[];
  /** FEATURES, the registry in ./index.ts. */
  registered: readonly FeatureDefinition[];
}>;

const KNOWN_USES: ReadonlySet<string> = new Set([...ENHANCEMENT_CAPABILITY_FIELDS, ...STAGE_USES]);
/**
 * The module that holds each certified stage's renderer contract: code that imports it runs on the
 * stage. Only Cartography is a stage of its own; what other Features need is files (game file
 * saving), input, network, or an Enhancement capability that `uses` already names.
 */
const STAGE_CONTRACTS: Readonly<Record<StageUse, string>> = { cartography: "app/shared/cartography-spike.ts" };
const GWONMAC_LINK = /^https:\/\/www\.gwonmac\.com(\/[^\s)]*)?$/;
/** A docs page by its name, as the website writes it: the website checks the target, the launcher opens its Guide or the page. */
const DOCS_LINK = /^\$docs\.[a-z0-9]+(-[a-z0-9]+)*(#[a-z0-9-]+)?$/;
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SHOT_FILE = /^media\/shot-(\d+)\.webp$/;

export const folderForId = (id: string): string => id.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

export function checkFeatureContract({ folders, registered }: FeatureContractInput): string[] {
  const problems: string[] = [];
  const ids = registered.map((feature) => feature.id);
  const registeredIds = new Set(ids);
  // Two folders cannot share an id: each id has one folder name, and a folder that holds another id fails below.
  for (const id of new Set(ids.filter((id, index) => ids.indexOf(id) !== index))) {
    problems.push(`app/features/index.ts: FEATURES lists "${id}" more than once; each Feature has one line.`);
  }
  for (const each of folders) problems.push(...checkFolder(each, registeredIds));
  const foundIds = new Set(folders.map(({ manifest }) => manifest.id));
  for (const feature of registered) {
    if (!foundIds.has(feature.id)) {
      problems.push(`app/features/index.ts: FEATURES lists "${feature.id}", but no app/features/${folderForId(feature.id)}/feature.ts exports it.`);
    }
  }
  problems.push(...checkRequires(registered));
  problems.push(...checkLinks(registered));
  return problems;
}

function checkFolder({ folder, manifest, files, readme, changelog, imports }: FeatureFolder, registeredIds: ReadonlySet<string>): string[] {
  const at = `app/features/${folder}`;
  const problems: string[] = [];
  if (folderForId(manifest.id) !== folder) {
    problems.push(`${at}/feature.ts: id "${manifest.id}" does not match its folder; the folder for it is app/features/${folderForId(manifest.id)}/.`);
  }
  if (!registeredIds.has(manifest.id)) problems.push(`${at}/feature.ts: "${manifest.id}" is not in FEATURES; add it to app/features/index.ts.`);
  if (manifest.name.trim() === "") problems.push(`${at}/feature.ts: name is empty.`);
  if (manifest.summary.trim() === "") problems.push(`${at}/feature.ts: summary is empty.`);
  if (manifest.settingsHelp?.trim() === "") problems.push(`${at}/feature.ts: settingsHelp is empty; remove it or say the rule.`);
  if (!KEBAB.test(manifest.icon)) problems.push(`${at}/feature.ts: icon "${manifest.icon}" is not a Lucide icon name in kebab case, such as "map-pin".`);
  if (!FEATURE_VERSION.test(manifest.version)) problems.push(`${at}/feature.ts: version "${manifest.version}" is not major.minor, such as "1.0".`);
  if (manifest.kind === "mode" && manifest.presence !== undefined) {
    problems.push(`${at}/feature.ts: the launch mode is the plain-game strip, not a card; remove presence.`);
  } else if (manifest.kind !== "mode" && manifest.presence === undefined) {
    problems.push(`${at}/feature.ts: no presence; its card tag says how players meet it (one of FEATURE_PRESENCES in app/features/define.ts).`);
  }

  const settings = Object.entries(manifest.settings ?? {});
  const switches = settings.flatMap(([key, spec]) => "switch" in spec && spec.switch === true ? [key] : []);
  if (switches.length > 1) problems.push(`${at}/feature.ts: ${switches.join(" and ")} are all switches; a feature has one switch.`);
  if (switches.length === 0 && (manifest.kind === "mode" || (manifest.requires ?? []).length === 0)) {
    problems.push(`${at}/feature.ts: no switch; declare one with featureSwitch, or list in requires the features it runs with.`);
  }
  if (switches.length === 0 && (manifest.requires ?? []).length > 0 && settings.length > 0) {
    problems.push(`${at}/feature.ts: ${settings.map(([key]) => key).join(", ")} have no page to show on; a feature without a switch is a section of the one it runs with, so its options belong there.`);
  }
  if (manifest.tool !== undefined && switches.length === 0) {
    problems.push(`${at}/feature.ts: tool needs a switch of its own; its card and Feature page turn it, so declare one in settings with featureSwitch.`);
  }
  for (const [key, spec] of settings) {
    if (spec.stage !== undefined) problems.push(...checkStagedSetting(at, key, spec, switches.includes(key), readme));
    if (switches.includes(key) && manifest.kind !== "mode") {
      if (spec.label !== undefined || spec.help !== undefined) {
        problems.push(`${at}/feature.ts: switch ${key} names itself; players see it under the feature's name and summary, so remove its label and help.`);
      }
      continue;
    }
    if (typeof spec.label !== "string" || spec.label.trim() === "") problems.push(`${at}/feature.ts: setting ${key} has no label; players see it as a row name.`);
    if (typeof spec.help !== "string" || spec.help.trim() === "") problems.push(`${at}/feature.ts: setting ${key} has no help; say in one line what it does.`);
  }

  for (const capability of manifest.uses ?? []) {
    if (!KNOWN_USES.has(capability)) {
      problems.push(`${at}/feature.ts: uses "${capability}", which the verifier does not know (ENHANCEMENT_CAPABILITY_FIELDS in app/shared/enhancement-contracts.ts, STAGE_USES in app/shared/contracts.ts).`);
    }
  }
  for (const stage of STAGE_USES) {
    if (imports.includes(STAGE_CONTRACTS[stage]) && !(manifest.uses ?? []).includes(stage)) {
      problems.push(`${at}/feature.ts: the folder imports ${STAGE_CONTRACTS[stage]}, so it runs on the certified ${stage} stage; add "${stage}" to uses so a refused stage turns it off with a reason.`);
    }
  }

  problems.push(...checkParts(at, manifest, files));
  if ((manifest.network ?? []).length > 0 && !manifest.parts.includes("main")) {
    problems.push(`${at}/feature.ts: network hosts are reached only from a main part; add main.ts and "main" to parts.`);
  }

  problems.push(...checkShots(at, manifest.shots, files));
  if (!files.some((file) => file.startsWith("media/"))) problems.push(`${at}/media/: missing; keep the folder (with .gitkeep while it has no pictures).`);
  if (readme === null) problems.push(`${at}/README.md: missing; say what the feature does in one or two sentences, then how to use it.`);
  else {
    problems.push(...checkReadme(`${at}/README.md`, readme));
    if (manifest.kind !== "mode" && switches.length === 1 && !/^### Details\n(?:(?!###).*\n)*?- \*\*Turn on:\*\* /m.test(readme)) {
      problems.push(`${at}/README.md: no "### Details" section with a "- **Turn on:** " line; say there where players turn it on (the scaffold's README shows the line).`);
    }
  }
  if (changelog === null) problems.push(`${at}/CHANGELOG.md: missing; start it with a "## Unreleased" heading.`);
  else if (!/^## Unreleased$/m.test(changelog)) problems.push(`${at}/CHANGELOG.md: no "## Unreleased" heading; the release script stamps it with the app version.`);
  return problems;
}

/**
 * Each part kind in `parts` has its file, and each part file its kind: `game` is companion.ts,
 * `window` is renderer/window.ts, `main` is main.ts and `hubPage` is renderer/host.ts. Two game
 * parts live elsewhere: a tool the input host runs (`tool.event`, Call Target in
 * app/renderer/input.ts), and a hubPage Feature's renderer/host.ts, which the game host also
 * builds its game code from (Character Switch). A kind without its file would pass typecheck and
 * do nothing. That each hubPage part has its line in app/features/hub-page-parts.ts, which the game
 * host starts, is checked in tests/unit/every-companion-part-is-registered.test.ts.
 */
function checkParts(at: string, manifest: FeatureDefinition, files: readonly string[]): string[] {
  const problems: string[] = [];
  const lists = (kind: FeaturePartKind) => manifest.parts.includes(kind);
  const hasCompanion = files.includes("companion.ts");
  if (hasCompanion && !lists("game")) problems.push(`${at}/feature.ts: the folder has companion.ts, so parts must list "game".`);
  if (lists("game") && !hasCompanion && manifest.tool?.event === undefined && !lists("hubPage")) {
    problems.push(`${at}/feature.ts: parts lists "game", but the folder has no companion.ts; add the game part there (featurePart) or remove "game".`);
  }
  for (const [kind, file] of [["window", "renderer/window.ts"], ["main", "main.ts"]] as const) {
    const has = files.includes(file);
    if (lists(kind) === has) continue;
    problems.push(has
      ? `${at}/feature.ts: the folder has ${file}, so parts must list "${kind}".`
      : `${at}/feature.ts: parts lists "${kind}", but the folder has no ${file}.`);
  }
  if (lists("hubPage") && !files.includes("renderer/host.ts")) {
    problems.push(`${at}/feature.ts: parts lists "hubPage", but the folder has no renderer/host.ts.`);
  }
  return problems;
}

/**
 * A staged option reads as false where the build does not show it (HIDDEN_SETTING_VALUE in
 * app/shared/settings/index.ts), so it must be a boolean, whose false is its off value; a whole
 * Feature is staged on its manifest, not on its switch. A `dev` option's README lines wait outside
 * README.md until it ships (docs/feature-contract.md#release-stages), so the website does not show
 * them; a `beta` option ships to players, so its lines are in the README.
 */
/** A Feature's own version: `major.minor`, without leading zeroes. */
export const FEATURE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;

function checkStagedSetting(at: string, key: string, spec: SettingSpec<unknown>, isSwitch: boolean, readme: string | null): string[] {
  const problems: string[] = [];
  if (isSwitch) problems.push(`${at}/feature.ts: switch ${key} has a stage; stage the whole Feature with stage on its manifest instead.`);
  else if (spec.kind !== "boolean") {
    problems.push(`${at}/feature.ts: setting ${key} has a stage but is of kind ${spec.kind}; where it is hidden it reads as false, so only a boolean option, whose false is off, may have one.`);
  }
  if (spec.stage === "dev" && readme !== null && readme.includes(`/${key}"}`)) {
    problems.push(`${at}/README.md: names ${key}, which has stage "${spec.stage}"; keep its lines in STAGED.md beside it until the option ships, so players do not read about it.`);
  }
  return problems;
}

function checkShots(at: string, shots: readonly string[], files: readonly string[]): string[] {
  const problems: string[] = [];
  shots.forEach((caption, index) => {
    if (caption.trim() === "") problems.push(`${at}/feature.ts: shot ${index + 1} has an empty caption.`);
    if (!files.includes(`media/shot-${index + 1}.webp`)) problems.push(`${at}/media/shot-${index + 1}.webp: missing for the caption "${caption}".`);
  });
  for (const file of files) {
    const shot = SHOT_FILE.exec(file);
    if (shot !== null && Number(shot[1]) > shots.length) problems.push(`${at}/${file}: has no caption; add one to shots or delete the file.`);
  }
  return problems;
}

/**
 * The Markdown the launcher renders and the website shows as the Feature's page: paragraphs,
 * `###` headings, numbered and bulleted lists, **bold**, `code`, links to www.gwonmac.com or to a
 * docs page (`$docs.<page>`), `:setting[Label]{to="..."}` names, <kbd> keys and one `>` note.
 */
export function checkReadme(path: string, text: string): string[] {
  const problems: string[] = [];
  const lines = text.split("\n");
  const first = lines.findIndex((line) => line.trim() !== "");
  if (first === -1) return [`${path}: empty; say what the feature does in one or two sentences.`];
  if (/^(#|>|\s*([-*+]|\d+\.)\s)/.test(lines[first] ?? "")) problems.push(`${path}:${first + 1}: start with what the feature does, as a plain sentence.`);
  let notes = 0;
  let inNote = false;
  lines.forEach((line, index) => {
    const where = `${path}:${index + 1}`;
    const heading = /^(#+)\s/.exec(line);
    if (heading !== null && heading[1]?.length !== 3) problems.push(`${where}: only ### headings are allowed.`);
    if (/^\s*\|/.test(line)) problems.push(`${where}: tables are not allowed.`);
    if (/!\[/.test(line)) problems.push(`${where}: images are not allowed; put pictures in media/ and caption them in shots.`);
    const tags = new Set([...line.matchAll(/<\/?([a-zA-Z][\w-]*)[^>]*>/g)].map((tag) => tag[1]));
    for (const tag of tags) {
      if (tag !== "kbd") problems.push(`${where}: HTML <${tag}> is not allowed; only <kbd> keys.`);
    }
    for (const link of line.replace(/!\[[^\]]*\]\([^)]*\)/g, "").matchAll(/\]\(([^)\s]*)\)/g)) {
      const target = link[1] ?? "";
      if (!GWONMAC_LINK.test(target) && !DOCS_LINK.test(target)) {
        problems.push(`${where}: link to ${target} is not allowed; link only to https://www.gwonmac.com or a docs page as $docs.<page>.`);
      }
    }
    for (const url of line.replace(/\]\([^)]*\)/g, "]").matchAll(/https?:\/\/[^\s)>]+/g)) {
      if (!GWONMAC_LINK.test(url[0])) problems.push(`${where}: ${url[0]} is an external link; link only to https://www.gwonmac.com.`);
    }
    const note = line.startsWith(">");
    if (note && !inNote) notes += 1;
    if (note && !inNote && notes === 2) problems.push(`${where}: only one > note is allowed.`);
    inNote = note;
  });
  return problems;
}

/** Every `links` target is another Feature whose `offers` lists each method called (app/features/links.ts). */
function checkLinks(registered: readonly FeatureDefinition[]): string[] {
  const byId = new Map(registered.map((feature) => [feature.id, feature]));
  const problems: string[] = [];
  for (const feature of registered) {
    const at = `app/features/${folderForId(feature.id)}/feature.ts`;
    for (const [target, methods] of Object.entries(feature.links ?? {})) {
      const offered = byId.get(target)?.offers;
      if (target === feature.id) problems.push(`${at}: links to itself; call your own code directly.`);
      else if (!byId.has(target)) problems.push(`${at}: links to "${target}", which is not a feature id.`);
      else if (offered === undefined) problems.push(`${at}: links to "${target}", which offers no link; add offers to app/features/${folderForId(target)}/feature.ts.`);
      else if (methods.length === 0) problems.push(`${at}: the link to "${target}" names no method; list the ones it calls.`);
      if (offered === undefined) continue;
      for (const method of methods) {
        if (!offered.includes(method)) problems.push(`${at}: calls "${target}.${method}", which ${target} does not offer (it offers ${offered.join(", ")}).`);
      }
    }
  }
  return problems;
}

function checkRequires(registered: readonly FeatureDefinition[]): string[] {
  const byId = new Map(registered.map((feature) => [feature.id, feature]));
  const problems: string[] = [];
  for (const feature of registered) {
    for (const required of feature.requires ?? []) {
      if (!byId.has(required)) problems.push(`app/features/${folderForId(feature.id)}/feature.ts: requires "${required}", which is not a feature id.`);
    }
  }
  const done = new Set<string>();
  const reported = new Set<string>();
  const visit = (id: string, path: readonly string[]): void => {
    const start = path.indexOf(id);
    if (start !== -1) {
      const cycle = [...path.slice(start), id];
      const key = [...cycle.slice(0, -1)].sort().join(",");
      if (!reported.has(key)) {
        reported.add(key);
        problems.push(`app/features/${folderForId(id)}/feature.ts: requires forms a cycle: ${cycle.join(" → ")}. A feature cannot need itself.`);
      }
      return;
    }
    if (done.has(id)) return;
    for (const required of byId.get(id)?.requires ?? []) {
      if (byId.has(required)) visit(required, [...path, id]);
    }
    done.add(id);
  };
  for (const feature of registered) visit(feature.id, []);
  return problems;
}
