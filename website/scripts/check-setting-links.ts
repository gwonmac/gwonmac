/**
 * Fails when a `:setting[Label]{to="..."}` link in the player text names a settings section or
 * control that the catalogue (app/shared/settings-catalogue.ts) does not have. The launcher
 * renders such a link as plain text without an error, so a renamed section goes unnoticed.
 *
 * Checked: Guide pages and the Feature pages generated from the Feature READMEs
 * (website/content/docs; `generate:feature-docs` runs before this check), and posts that no
 * installed app has read yet. A post in the launcher feed is frozen (old apps read its body
 * from website/public/launcher/news-v1.json), so it keeps the words of its day.
 *
 *   node --import ../scripts/ts-hook.mjs scripts/check-setting-links.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { settingsLinkTarget } from "../../app/shared/settings-catalogue.ts";

const root = path.resolve(import.meta.dirname, "../..");
const files: string[] = [];
for (const directory of ["website/content/docs", "website/content/posts"]) {
  for (const name of readdirSync(path.join(root, directory))) if (name.endsWith(".md")) files.push(`${directory}/${name}`);
}

const isFrozenPost = (file: string, text: string) =>
  file.startsWith("website/content/posts/") && /^launcherId:/mu.test(text) && !/^draft:\s*true/mu.test(text);

const broken: string[] = [];
for (const file of files) {
  let text: string;
  try { text = readFileSync(path.join(root, file), "utf8"); } catch { continue; }
  if (isFrozenPost(file, text)) continue;
  for (const [, to] of text.matchAll(/:setting\[[^\]]*\]\{to="([^"]*)"\}/gu)) {
    try { settingsLinkTarget(to!); } catch { broken.push(`${file}: to="${to}"`); }
  }
}
if (broken.length) {
  console.error(`Settings links that the catalogue does not know:\n${broken.map(line => `  ${line}`).join("\n")}`);
  process.exit(1);
}
console.log(`Settings links ok (${files.length} files checked).`);
