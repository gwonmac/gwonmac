// A syntax error in one stylesheet can break the next one. The Hub bundle joins
// the Settings stylesheets before minifying, so one stray `}` at the end of
// settings-view.css made the minifier drop the first rule of hub-settings.css.
// The browser recovers from such errors without a word, so nothing else
// notices. This parses every stylesheet and every `.vue` `<style>` block under
// app/ with lightningcss, the parser Vite itself minifies with, and fails on
// any error.
//
//   node --import ./scripts/ts-hook.mjs --test tests/unit/every-stylesheet-parses.test.ts
import assert from "node:assert/strict";
import { globSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

// Vite's own copy, resolved through a workspace that depends on Vite, so the
// version is the one that builds the app and the root needs no second copy.
const vite = createRequire(import.meta.url).resolve("vite", { paths: ["app/ui/launcher"] });
/** The one call this test makes. lightningcss is Vite's dependency, so its types are not the root's. */
const lightningcss: { transform(options: { filename: string; code: Uint8Array; errorRecovery: boolean }): unknown } =
  createRequire(vite)("lightningcss");

/** The line a lightningcss parse error points at. */
const lineOf = (error: unknown) =>
  typeof error === "object" && error !== null && "loc" in error && typeof error.loc === "object" && error.loc !== null && "line" in error.loc
    ? String(error.loc.line)
    : "?";

/** A `.vue` file's `<style>` blocks, with everything else blanked so line numbers stay the file's own. */
function styleOf(source: string): string {
  return source.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)|[^\n]/g, (match, open?: string, body?: string) =>
    open === undefined ? "" : open.replace(/[^\n]/g, "") + body);
}

const files = globSync("app/**/*.{css,vue}", { exclude: (path) => path.includes("node_modules") || /(^|\/)dist\//.test(path) }).sort();

test("the glob finds the stylesheets", () => {
  // A broken glob would pass by parsing nothing.
  for (const path of ["app/shared/ui/tokens.css", "app/ui/launcher/src/settings-view.css", "app/ui/launcher/src/components/BaseModal.vue"]) {
    assert.ok(files.includes(path), `${path} is parsed`);
  }
});

test("every stylesheet parses without an error", () => {
  const errors: string[] = [];
  for (const path of files) {
    const source = readFileSync(path, "utf8");
    const css = path.endsWith(".vue") ? styleOf(source) : source;
    if (css.trim() === "") continue;
    try {
      lightningcss.transform({ filename: path, code: Buffer.from(css), errorRecovery: false });
    } catch (error) {
      errors.push(`${path}:${lineOf(error)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  assert.deepEqual(errors, [], errors.join("\n"));
});
