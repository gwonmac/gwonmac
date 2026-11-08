// The interface has two token sources and no third. One hardcoded colour in a
// component is invisible in review and becomes an accidental second style.
//
// - The launcher names its colours once, in `app/ui/launcher/src/tokens.css`.
//   Those names apply on the launcher's `<html data-launcher>` and on
//   `.settings-view` only, so the Hub's copy of the Settings page has them and
//   the rest of the game document does not.
// - Every other stylesheet drawn in the game (the Hub, the Tools, the renderer
//   and feature overlay .css files) reads only names from
//   `app/shared/ui/tokens.css` or names it sets itself. Files on
//   `NOT_YET_TOKENISED`, and overlays that set colours from TypeScript, are
//   outside what this test can see.
//
// So the claim is enforced rather than asserted, over every stylesheet and
// every `.vue` `<style>` block, found by glob: a new file is covered the day it
// lands, without anyone remembering to list it. Files that cannot meet a rule
// yet are on `NOT_YET_TOKENISED`, each with its reason.
//
// The test also runs the other way: a token nothing reads is dead weight in
// the one file people open to find out what they are allowed to change.
//
//   node --import ./scripts/ts-hook.mjs --test \
//     tests/unit/the-ui-system-has-one-place-to-change-a-colour.test.ts
import assert from "node:assert/strict";
import { globSync, readFileSync } from "node:fs";
import { posix } from "node:path";
import test from "node:test";

const TOKENS = "app/shared/ui/tokens.css";
const LAUNCHER_TOKENS = "app/ui/launcher/src/tokens.css";
const SETTINGS = "app/ui/launcher/src/settings-view.css";
/** Drawn only in the game's Hub: it maps Settings onto the in-game tokens. */
const HUB_SETTINGS = "app/ui/launcher/src/hub-settings.css";
const TOKEN_SOURCES = new Set([TOKENS, LAUNCHER_TOKENS]);

type Rule = "colour" | "radius" | "z-index";
type System = "launcher" | "in-game";

const LAUNCHER_SCALE =
  "the launcher has no stacking scale, and these radii are off its --radius-* scale; choosing one is a visual change";

/**
 * Surfaces that cannot meet a rule yet, each with the rules it is excused from
 * and the reason. Re-pointing them is its own visual change.
 *
 * The staleness test below is what stops this being a quiet exemption: the day
 * one of these files meets a rule it is excused from, it fails here until the
 * rule is taken off its entry.
 */
const NOT_YET_TOKENISED: Record<string, { rules: Rule[]; reason: string }> = {
  "app/renderer/harness.css": {
    rules: ["colour", "radius", "z-index"],
    reason: "the renderer's game overlays predate the token system",
  },
  "app/features/character-switch/renderer/character-switch.css": {
    rules: ["colour", "z-index"],
    reason: "the renderer's game overlays predate the token system",
  },
  "app/renderer/loading.css": {
    rules: ["colour", "radius", "z-index"],
    reason: "the boot screen is a plain <link> in index.html and paints before the bundle brings tokens.css",
  },
  "app/ui/tools/src/styles/elite-skills.css": {
    rules: ["colour", "radius", "z-index"],
    reason: "opaque panel fills are derived in place with rgb(from …), and its layers and image corners are literal",
  },
  "app/ui/tools/src/WhispersApp.vue": {
    rules: ["colour", "z-index"],
    reason: "the window's background-opacity setting mixes tokens in place, and the options menu stacks with a literal 2 (the --ui-z-* scale has no menu layer)",
  },
  "app/ui/launcher/src/components/MarkdownInline.vue": {
    rules: ["colour", "radius"],
    reason: "the link underline mixes currentColor in place; " + LAUNCHER_SCALE,
  },
  [SETTINGS]: { rules: ["radius", "z-index"], reason: LAUNCHER_SCALE },
  "app/ui/launcher/src/style.css": { rules: ["radius", "z-index"], reason: LAUNCHER_SCALE },
  "app/ui/launcher/src/components/BaseModal.vue": { rules: ["z-index"], reason: LAUNCHER_SCALE },
  "app/ui/launcher/src/components/ColorControl.vue": { rules: ["radius"], reason: LAUNCHER_SCALE },
  "app/ui/launcher/src/components/HomeView.vue": { rules: ["radius", "z-index"], reason: LAUNCHER_SCALE },
  "app/ui/launcher/src/components/MapStylePreview.vue": { rules: ["radius"], reason: LAUNCHER_SCALE },
  "app/ui/launcher/src/components/NewsFeed.vue": { rules: ["radius", "z-index"], reason: LAUNCHER_SCALE },
  "app/ui/launcher/src/components/NewsSourceMark.vue": { rules: ["radius"], reason: LAUNCHER_SCALE },
  "app/ui/launcher/src/components/PanelStylePreview.vue": { rules: ["radius"], reason: LAUNCHER_SCALE },
  "app/ui/launcher/src/components/ShortcutSetting.vue": { rules: ["radius", "z-index"], reason: LAUNCHER_SCALE },
  "app/ui/launcher/src/components/SkillLabelsSettings.vue": { rules: ["radius"], reason: LAUNCHER_SCALE },
};

/** Strip comments (keeping line breaks), so prose about `oklch(20% …)` is not read as a declaration. */
const code = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));

/** A `.vue` file's `<style>` blocks, with everything else blanked so line numbers stay the file's own. */
function styleOf(path: string, source: string): string {
  if (!path.endsWith(".vue")) return source;
  let style = "";
  let at = 0;
  for (const match of source.matchAll(/(<style[^>]*>)([\s\S]*?)<\/style>/g)) {
    const start = match.index + match[1]!.length;
    style += source.slice(at, start).replace(/[^\n]/g, "") + match[2]!;
    at = start + match[2]!.length;
  }
  return style;
}

type StyleFile = { path: string; system: System; css: string; source: string };

/** Every stylesheet and every `.vue` `<style>` block of the interface. */
const files: StyleFile[] = globSync([
  "app/ui/*/src/**/*.{css,vue}",
  "app/shared/ui/**/*.css",
  "app/renderer/**/*.css",
  "app/features/*/renderer/**/*.css",
])
  .sort()
  .map((path) => {
    const source = readFileSync(path, "utf8");
    const system: System =
      path.startsWith("app/ui/launcher/") && path !== HUB_SETTINGS ? "launcher" : "in-game";
    return { path, system, source, css: code(styleOf(path, source)) };
  })
  .filter(({ css }) => css.trim() !== "");

const excused = (path: string, rule: Rule) => NOT_YET_TOKENISED[path]?.rules.includes(rule) ?? false;
const checked = (rule: Rule) => files.filter(({ path }) => !excused(path, rule));
const file = (path: string) => files.find((entry) => entry.path === path)!;

/** CSS named colours. `transparent`, `currentColor` and `inherit` are not paint of their own. */
const NAMED_COLOURS = new Set(`aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue
blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue
darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid
darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink
deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold
goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush
lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey
lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime
limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen
mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin
navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise
palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue
saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow
springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen`.split(/\s+/u));

/** Properties whose value is or holds a colour. A custom property counts: `--x: white` is still a raw colour. */
const COLOUR_PROPERTY = /^(?:--[a-z0-9-]+|color|background(?:-color|-image)?|border(?:-[a-z]+)*|outline(?:-color)?|(?:box|text)-shadow|fill|stroke|caret-color|accent-color|text-decoration(?:-color)?|column-rule(?:-color)?|scrollbar-color|-webkit-text-fill-color|-webkit-tap-highlight-color|filter)$/u;

/** The first named colour a line paints with, if any. */
function namedColour(line: string): string | undefined {
  for (const [, property, value] of line.matchAll(/([a-z-]+)\s*:\s*([^;{}]*)/gu)) {
    if (!COLOUR_PROPERTY.test(property!)) continue;
    const words = value!.replace(/url\([^)]*\)|"[^"]*"|'[^']*'|--[a-z0-9-]+/gu, " ").match(/(?<![-\w.#])[a-z]+(?![-\w])/giu) ?? [];
    const found = words.find((word) => NAMED_COLOURS.has(word.toLowerCase()));
    if (found) return found;
  }
  return undefined;
}

/** A token source may hold literals only where it declares a token. */
const withoutTokenDeclarations = (css: string) =>
  css.replace(/--[a-z0-9-]+\s*:[^;}]*/g, (declaration) => declaration.replace(/[^\n]/g, " "));

/** The lines that break a rule, as `path:line: text`. */
function offences(rule: Rule, { path, css }: StyleFile): string[] {
  const lines = (TOKEN_SOURCES.has(path) && rule === "colour" ? withoutTokenDeclarations(css) : css).split("\n");
  const found: string[] = [];
  lines.forEach((line, index) => {
    const at = `${path}:${index + 1}: `;
    if (rule === "colour") {
      // Hex literals, functional colour notations, and local mixes all
      // create feature-owned paint. Mixtures belong in the shared
      // projection/component layer where every surface gets the same state.
      const hex = line.match(/#[0-9a-fA-F]{3,8}\b/);
      const fn = line.match(/\b(rgba?|hsla?|oklch|lab|lch)\(/);
      const mix = !TOKEN_SOURCES.has(path) && path !== "app/shared/ui/components.css" && line.match(/\bcolor-mix\(/);
      if (hex || fn || mix || namedColour(line)) found.push(at + line.trim());
    } else if (rule === "radius") {
      // Every radius declaration on the line, not just the first: a rule
      // written on one line would otherwise hide behind its neighbour.
      for (const match of line.matchAll(/border(?:-[a-z]+)*-radius\s*:([^;}]*)/g)) {
        // `0` is a real answer — a tab's bottom corners are square by
        // design, and that is shape rather than a themeable length.
        if (/\b\d+(\.\d+)?(px|rem|em|%)/.test(match[1]!)) found.push(at + match[0]!.trim());
      }
    } else {
      // -1 and 1 park the on-screen-keyboard fields behind and in front of
      // the canvas. They are not a layer in the interface's own stack.
      const match = line.match(/z-index\s*:\s*(-?\d+)/);
      if (match && Math.abs(Number(match[1])) > 1) found.push(at + line.trim());
    }
  });
  return found;
}

/** Every `--…` declared on the left of a colon. */
function declared(css: string, prefix = "--"): Set<string> {
  const names = new Set<string>();
  for (const match of code(css).matchAll(/(--[a-z0-9-]+)\s*:/g)) {
    if (match[1]!.startsWith(prefix)) names.add(match[1]!);
  }
  return names;
}

/** Every `var(--…)` reference. */
function referenced(css: string, prefix = "--"): Set<string> {
  const names = new Set<string>();
  for (const match of code(css).matchAll(/var\((--[a-z0-9-]+)/g)) {
    if (match[1]!.startsWith(prefix)) names.add(match[1]!);
  }
  return names;
}

/** Custom properties a `.vue` file sets on its own elements (`:style="{ '--swatch': … }"`). */
const local = (source: string) => new Set([...source.matchAll(/['"](--[a-z0-9-]+)['"]\s*:/g)].map((match) => match[1]!));

const tokens = readFileSync(TOKENS, "utf8");
const inGameTokens = declared(tokens, "--ui-");
const inGameNames = declared(tokens);
/**
 * Names an in-game stylesheet reads but does not declare, because TypeScript sets
 * them on the element: each with the file that sets it and why. The staleness
 * test below keeps each entry true.
 */
const IN_GAME_PROVIDED: Record<string, { setBy: string; reason: string }> = {
  "--cartography-control-size": { setBy: "app/features/cartography/renderer/overlay-controls.ts", reason: "the trigger's size, from COMPASS_CONTROL_SIZE" },
  "--cartography-panel-width": { setBy: "app/features/cartography/renderer/overlay-controls.ts", reason: "the panel's width, from PANEL_WIDTH" },
  "--cartography-trigger-border": { setBy: "app/features/cartography/renderer/overlay-controls.ts", reason: "the active map style's boundary colour" },
  "--compass-range-control-size": { setBy: "app/features/cartography/renderer/compass-range-controls.ts", reason: "the trigger's size, from COMPASS_CONTROL_SIZE" },
  "--compass-range-panel-width": { setBy: "app/features/cartography/renderer/compass-range-controls.ts", reason: "the panel's width, from PANEL_WIDTH" },
  "--compass-range-color": { setBy: "app/features/cartography/renderer/compass-range-controls.ts", reason: "each range's colour, from compass-ranges.ts" },
  "--character-cards": { setBy: "app/features/character-switch/hub-views/HubCharacters.vue", reason: "the carousel's card count" },
};
const launcherTokens = declared(readFileSync(LAUNCHER_TOKENS, "utf8"));

test("the glob finds both systems and both token sources", () => {
  // A broken glob would pass every rule below by checking nothing.
  const paths = files.map(({ path }) => path);
  for (const path of [TOKENS, LAUNCHER_TOKENS, SETTINGS, HUB_SETTINGS, "app/shared/ui/components.css", "app/ui/tools/src/styles/trade.css", "app/ui/launcher/src/components/ShortcutSetting.vue"]) {
    assert.ok(paths.includes(path), `${path} is checked`);
  }
  for (const path of Object.keys(NOT_YET_TOKENISED)) assert.ok(paths.includes(path), `${path} still exists`);
});

test("no component decides a colour for itself", () => {
  const offenders = checked("colour").flatMap((entry) => offences("colour", entry));
  assert.deepEqual(offenders, [], `every colour must resolve through a token:\n${offenders.join("\n")}`);
});

test("no component decides a corner for itself", () => {
  const offenders = checked("radius").flatMap((entry) => offences("radius", entry));
  assert.deepEqual(offenders, [], `border-radius must come from a radius token:\n${offenders.join("\n")}`);
});

test("no consumer invents a stacking order", () => {
  // Two surfaces that each pick their own z-index is how a toast ends up
  // behind the panel it is reporting on. The scale is in tokens.css.
  const offenders = checked("z-index").flatMap((entry) => offences("z-index", entry));
  assert.deepEqual(offenders, [], `z-index must come from the --ui-z-* scale:\n${offenders.join("\n")}`);
});

test("style projections stay in tokens and consumers do not branch", () => {
  const selectors = [...code(tokens).matchAll(/:root\[data-ui-style="([^"]+)"\]/gu)]
    .map((match) => match[1]);
  assert.deepEqual(selectors, ["obsidian"]);
  for (const { path, css } of files) {
    if (path === TOKENS) continue;
    assert.doesNotMatch(css, /\[data-ui-(?:style|theme|density)=/u, path);
  }
});

test("persistent interaction states do not leak into neutral controls", () => {
  const components = readFileSync("app/shared/ui/components.css", "utf8");
  const toolsShell = readFileSync("app/ui/tools/src/styles/base-shell.css", "utf8");
  const rule = (source: string, selector: string): string => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    return source.match(new RegExp(`^${escaped}\\s*\\{([^}]*)\\}`, "mu"))?.[1] ?? "";
  };

  assert.match(rule(components, ".ui-button"), /var\(--ui-command-fill\)/u);
  assert.match(rule(components, '.ui-button[data-variant="primary"]'), /var\(--ui-primary-fill\)/u);
  assert.doesNotMatch(rule(components, ".ui-button[data-icon]"), /--ui-shadow-selected/u);
  assert.doesNotMatch(rule(components, ".ui-slot"), /--ui-shadow-selected/u);
  assert.doesNotMatch(rule(toolsShell, ".window-brand"), /--ui-shadow-selected/u);
  assert.match(
    rule(components, '.ui-tab[aria-selected="true"]'),
    /inset 0 -2px 0 var\(--ui-selection-marker\)/u,
  );
  assert.match(rule(components, '.ui-button[data-variant="quiet"]'), /background: transparent/u);
  assert.doesNotMatch(rule(components, '.ui-row'), /--ui-row-fill/u);
});

test("shared interaction feedback owns disabled, active, and error presentation", () => {
  const components = code(readFileSync("app/shared/ui/components.css", "utf8"));
  const catalogue = code(readFileSync("app/ui/tools/src/styles/catalogue.css", "utf8"));
  const build = code(readFileSync("app/ui/tools/src/styles/build.css", "utf8"));

  for (const selector of [
    '.ui-button[aria-disabled="true"]',
    ".ui-input:disabled",
    ".ui-segment button:disabled",
    ".ui-tab:disabled",
    '.ui-row[aria-disabled="true"]',
    'button.ui-chip[aria-disabled="true"]',
  ]) {
    assert.ok(components.includes(selector), `${selector} has shared disabled feedback`);
  }
  for (const selector of [
    ".ui-segment button:active:not(:disabled)",
    ".ui-tab:active:not(:disabled)",
    '.ui-row:active:not([aria-disabled="true"])',
  ]) {
    assert.ok(components.includes(selector), `${selector} has pointer feedback`);
  }
  assert.match(components, /\.ui-field-error\s*\{/u);
  assert.doesNotMatch(catalogue, /\.field-error\s*\{/u);
  assert.doesNotMatch(build, /\.authoring-tabs > button:focus-visible\s*\{/u);
  assert.match(components, /\.ui-frame :where\([^}]*\):focus-visible\s*\{/u);
});

test("the Hub's Settings page loads the launcher tokens it reads", () => {
  // The Hub draws Settings without the launcher's stylesheet. Without tokens.css
  // on .settings-view there, every launcher colour on the page drops out.
  const hubEntry = readFileSync("app/ui/launcher/src/hub-entry.ts", "utf8");
  assert.match(hubEntry, /import "\.\/tokens\.css";\s*import "\.\/controls\.css";\s*import "\.\/settings-view\.css";/u);
  assert.match(code(readFileSync(LAUNCHER_TOKENS, "utf8")), /^:root\[data-launcher\], \.settings-view \{/mu);
  // Only the launcher's own document carries the attribute, so the names never
  // reach the game document's :root.
  assert.match(readFileSync("app/ui/launcher/index.html", "utf8"), /<html [^>]*\bdata-launcher\b/u);
});

/** Every component the Settings page renders: each relative `.vue` import, static or dynamic, followed from SettingsView. */
function settingsPageComponents(): Set<string> {
  const seen = new Set<string>();
  const visit = (path: string) => {
    if (seen.has(path)) return;
    seen.add(path);
    for (const [, target] of readFileSync(path, "utf8").matchAll(/(?:\bfrom|\bimport\s*\(?)\s*["'](\.{1,2}\/[^"']+\.vue)["']/gu)) {
      visit(posix.join(posix.dirname(path), target!));
    }
  };
  visit("app/ui/launcher/src/components/SettingsView.vue");
  return seen;
}

/** The stylesheets the Settings page draws with: its own, the shared buttons, and every component it renders. */
const settingsPageStyles = () =>
  [SETTINGS, "app/ui/launcher/src/controls.css", ...settingsPageComponents()].map((path) => code(styleOf(path, readFileSync(path, "utf8"))));

/** The launcher names hub-settings.css re-points: its `.hub-settings-host .settings-view` rules, inside at-rules too, as name → value. */
function hubRepoints(): Map<string, string> {
  const repoints = new Map<string, string>();
  for (const { selectors, declarations } of rules(code(readFileSync(HUB_SETTINGS, "utf8")))) {
    if (!selectors.includes(".hub-settings-host .settings-view")) continue;
    for (const [property, value] of declarations) if (launcherTokens.has(property)) repoints.set(property, value);
  }
  return repoints;
}

test("the Hub's Settings page takes every colour it reads from the Hub theme", () => {
  // A Settings rule or component that reads a launcher colour hub-settings.css
  // does not re-point draws launcher gold or red inside a blue Hub, as the
  // section list and the Delete style dialog once did. Radii and the small type
  // sizes stay the launcher's on purpose; fonts and body size follow the Hub.
  assert.ok(settingsPageComponents().has("app/ui/launcher/src/components/BaseModal.vue"), "the walk reaches the dialog");
  const read = new Set(settingsPageStyles().flatMap((css) => [...referenced(css)].filter((name) => launcherTokens.has(name))));
  const repoints = hubRepoints();
  const repointed = new Set(repoints.keys());
  const scale = (name: string) => /^--(?:radius|fs)-/u.test(name);
  const missing = [...read].filter((name) => !scale(name) && !repointed.has(name));
  assert.deepEqual(missing, [], `read by the Settings page but not re-pointed for the Hub: ${missing.join(", ")}`);
  const stale = [...repointed].filter((name) => launcherTokens.has(name) && !read.has(name));
  assert.deepEqual(stale, [], `re-pointed for the Hub but not read by the Settings page: ${stale.join(", ")}`);
  // A re-point that reads another launcher name (`--gold: var(--gold-text)`) still paints launcher gold.
  const launcherValued = [...repoints].filter(([, value]) => [...referenced(value)].some((name) => !name.startsWith("--ui-")));
  assert.deepEqual(launcherValued.map(([name, value]) => `${name}: ${value}`), [], "a Hub re-point reads only --ui-* names");
});

type CssRule = { context: string; selectors: string[]; declarations: [property: string, value: string][] };

/** Each rule as its at-rule context, its selectors and its declarations. */
function rules(css: string, context = ""): CssRule[] {
  const out: CssRule[] = [];
  let at = 0;
  for (let open = css.indexOf("{", at); open >= 0; open = css.indexOf("{", at)) {
    let close = open + 1;
    for (let depth = 1; depth > 0; close++) depth += css[close] === "{" ? 1 : css[close] === "}" ? -1 : 0;
    const head = css.slice(at, open).trim();
    const body = css.slice(open + 1, close - 1);
    if (head.startsWith("@")) out.push(...rules(body, `${context}${head} `));
    else {
      out.push({
        context,
        selectors: head.split(/,(?![^(]*\))/u).map((selector) => selector.replace(/\s+/gu, " ").trim()),
        declarations: body.split(";").filter((declaration) => declaration.includes(":")).map((declaration) => {
          const colon = declaration.indexOf(":");
          return [declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim()];
        }),
      });
    }
    at = close;
  }
  return out;
}

/** The shorthand a property belongs to, so `padding` and `padding-block` are one property. */
const family = (property: string) =>
  property.match(/^(?:padding|margin|inset|gap|overflow|background|outline|font|border-radius|border|flex(?=$|-(?:grow|shrink|basis)))/u)?.[0] ?? property;

test("Settings sets each property of a selector in one rule", () => {
  // The page was once three stacked copies of itself, where the last rule
  // silently won and an edit to an earlier one did nothing.
  const seen = new Map<string, number>();
  for (const { context, selectors, declarations } of rules(file(SETTINGS).css)) {
    for (const selector of selectors) {
      for (const property of new Set(declarations.map(([property]) => family(property)))) {
        const key = `${context}${selector} { ${property} }`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
    }
  }
  const repeated = [...seen].filter(([, count]) => count > 1).map(([key]) => key);
  assert.deepEqual(repeated, [], `set in more than one rule:\n${repeated.join("\n")}`);
});

test("every token a stylesheet uses is actually declared", () => {
  // An undeclared token is a declaration the browser drops: the rule silently
  // loses its colour. In-game files read app/shared/ui/tokens.css and their
  // own names: a launcher name read there passes in the launcher's tests and
  // paints nothing in the game. Launcher files read the launcher tokens.
  const missing: string[] = [];
  for (const { path, system, css, source } of files) {
    const own = new Set([...declared(css), ...local(source)]);
    if (system === "in-game") {
      for (const name of referenced(css)) {
        if (!inGameNames.has(name) && !own.has(name) && !(name in IN_GAME_PROVIDED)) missing.push(`${path}: ${name}`);
      }
      continue;
    }
    for (const name of referenced(css)) {
      if (!launcherTokens.has(name) && !own.has(name)) missing.push(`${path}: ${name}`);
    }
  }
  assert.deepEqual(missing, [], `undeclared tokens: ${missing.join(", ")}`);
});

test("every token declared is actually read", () => {
  // The token file is the retheming documentation. A variable nothing reads is
  // a promise to a reader that changing it will do something.
  const inGame = files.filter(({ system }) => system === "in-game");
  const usedInGame = new Set(inGame.flatMap(({ css }) => [...referenced(css, "--ui-")]));
  const unusedInGame = [...inGameTokens].filter((name) => !usedInGame.has(name));
  assert.deepEqual(unusedInGame, [], `declared in tokens.css but never read: ${unusedInGame.join(", ")}`);

  const usedByLauncher = new Set(files.filter(({ system }) => system === "launcher").flatMap(({ css }) => [...referenced(css)]));
  const unusedByLauncher = [...launcherTokens].filter((name) => !usedByLauncher.has(name));
  assert.deepEqual(unusedByLauncher, [], `declared in the launcher tokens.css but never read: ${unusedByLauncher.join(", ")}`);
});

test("no token reference carries a leftover alpha suffix", () => {
  // `#f3dd9d1a` is a colour with an alpha pair on the end. Substituting the
  // six-digit part for a token leaves `var(--ui-accent)1a`, which is not a
  // colour — the declaration is dropped and the rule silently loses its
  // background. It renders as "nothing happened", which is the hardest kind of
  // CSS bug to see. The fix is `color-mix()`, which is themeable anyway.
  const offenders: string[] = [];
  for (const { path, css } of files) {
    for (const match of css.matchAll(/var\(--[a-z0-9-]+\)[0-9a-fA-F]{2}/g)) {
      offenders.push(`${path}: ${match[0]}`);
    }
  }
  assert.deepEqual(offenders, [], offenders.join("\n"));
});

test("the measured Guild Wars radii are fixed in the token source", () => {
  const body = code(tokens);
  for (const name of ["--ui-radius", "--ui-radius-sm", "--ui-radius-lg", "--ui-radius-swell"]) {
    const line = body.match(new RegExp(`${name}\\s*:([^;]*);`));
    assert.ok(line, `${name} is declared`);
    assert.match(line[1]!, /\d+px/u, `${name} is a measured fixed length`);
  }
});

test("a not-yet-tokenised surface still needs each rule it is excused from", () => {
  // An exemption nobody rechecks becomes permission. Each excused rule has to
  // still be broken: once a file meets it, this fails until someone takes the
  // rule off the file's entry, where the real check then applies.
  for (const [path, { rules }] of Object.entries(NOT_YET_TOKENISED)) {
    for (const rule of rules) {
      assert.ok(offences(rule, file(path)).length > 0, `${path} meets the ${rule} rule now — take it off NOT_YET_TOKENISED`);
    }
  }
});

test("each name TypeScript provides is still read and still set there", () => {
  // Like NOT_YET_TOKENISED: an entry no stylesheet needs, or that its file no
  // longer sets, is a hole in the undeclared-token check above.
  for (const [name, { setBy }] of Object.entries(IN_GAME_PROVIDED)) {
    const readers = files.filter(({ system, css, source }) =>
      system === "in-game" && referenced(css).has(name) && !declared(css).has(name) && !local(source).has(name));
    assert.ok(readers.length > 0, `no in-game stylesheet reads ${name} without declaring it — take it off IN_GAME_PROVIDED`);
    assert.ok([`"${name}"`, `'${name}'`].some((quoted) => readFileSync(setBy, "utf8").includes(quoted)), `${setBy} no longer sets ${name}`);
  }
});
