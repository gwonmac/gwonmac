/**
 * Owns how the app and the website's build scripts read website Markdown front
 * matter: the news feed generator, the bundled release notes and the Guide.
 * One reader, so a quoted title, CRLF line ends or `draft: true` mean the same
 * thing everywhere.
 *
 * It reads the small subset of YAML the website uses: `key: value` lines, one
 * level of indented keys (read as `parent.key`), and values in double quotes,
 * which YAML needs around a ": ". Anything else is refused, not guessed.
 *
 * No imports: website/scripts/generate-launcher-news.mjs runs this file under
 * plain Node, which cannot resolve the app's `.js` import specifiers.
 */

export interface WebsitePage {
  readonly fields: Readonly<Record<string, string>>;
  /** The Markdown after the front matter, unchanged. */
  readonly body: string;
  /** A draft is written but not published: the website and the news feed wait for it. */
  readonly draft: boolean;
}

export function readFrontMatter(source: string): WebsitePage {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/u.exec(source.replace(/\r/gu, ""));
  if (!match) throw new Error("front matter is missing");
  const fields: Record<string, string> = {};
  let parent = "";
  for (const line of match[1]!.split("\n")) {
    if (!line.trim()) continue;
    const field = /^(\s*)([\w.-]+):\s*(.*)$/u.exec(line);
    if (!field || (field[1] && !parent)) throw new Error(`unsupported front matter line: ${line}`);
    const key = field[1] ? `${parent}.${field[2]}` : field[2]!;
    if (!field[1]) parent = field[2]!;
    fields[key] = field[3]!.replace(/^"(.*)"$/u, "$1");
  }
  return { fields, body: match[2]!, draft: fields.draft === "true" };
}
