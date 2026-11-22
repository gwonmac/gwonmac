/**
 * The launcher's Guide: the website's player guide pages, built into the app so
 * the Guide matches this version and works offline. The website renders the
 * same Markdown, so a page is written once in website/content.
 *
 * Links become action IDs the Help page resolves: `guide:<page>#<anchor>`,
 * `settings:<section>[/<control>]`, `feature:<folder>` for a Feature's own page in the
 * Features tab (its website page is built from the same README), or `url:<https address>`
 * for the browser.
 */
import { FEATURES, folderForId, type FeatureId } from "@shared/feature-contracts";
import { parseMarkdown, type MarkdownBlock } from "@shared/launcher-markdown";
import { settingsLinkTarget, type SettingsTarget } from "@shared/settings-catalogue";
import { LAUNCHER_GUIDE_ORIGINS } from "@shared/launcher-contracts";
import { readFrontMatter } from "@shared/website-content";

const WEBSITE = "https://www.gwonmac.com";
const IMAGE_DIRECTORY = "../../../../website/public";

/**
 * The website pages the Guide shows, by their docs entry name (the file name in
 * website/content/docs without number and extension, which is also the
 * English slug), grouped as in Help's sidebar. Install, mobile linking and the
 * comparison pages stay on the website: whoever reads this already has the app.
 */
const PAGE_NAMES = {
  "known-issues": "known-issues",
  troubleshooting: "troubleshooting",
  accounts: "accounts-and-launcher",
  hub: "hub",
  "travel-and-maps": "travel-and-maps",
  "chat-and-trade": "chat-and-trade",
  inventory: "inventory",
  combat: "combat",
  templates: "templates",
  appearance: "appearance",
  performance: "performance",
  "game-files-and-updates": "game-files-and-updates",
} as const;
export type GuidePageId = keyof typeof PAGE_NAMES;
export const GUIDE_PAGE_IDS = Object.keys(PAGE_NAMES) as GuidePageId[];
export const GUIDE_HELP_PAGES: readonly GuidePageId[] = ["known-issues", "troubleshooting"];

/** Each Feature's docs entry name (its folder) and id; the launch mode has no card, so it opens the tab. */
const FEATURE_PAGES: ReadonlyMap<string, FeatureId | null> = new Map(
  FEATURES.map((feature) => [folderForId(feature.id), feature.kind === "mode" ? null : feature.id]),
);

export interface GuidePage {
  readonly id: GuidePageId;
  readonly title: string;
  readonly summary: string;
  readonly blocks: readonly MarkdownBlock[];
}

export type GuideAction =
  | Readonly<{ kind: "guide"; page: GuidePageId; anchor?: string }>
  | Readonly<{ kind: "settings"; target: SettingsTarget }>
  /** A Feature's page in the Features tab (`id` null: the tab itself); `url` is its website page. */
  | Readonly<{ kind: "feature"; id: FeatureId | null; url: string }>
  | Readonly<{ kind: "url"; url: string }>;

// English only: `<n>.<name>.md`; a translation is `<n>.<name>.<locale>.md`.
const sources = import.meta.glob<string>(["../../../../website/content/docs/*.md", "!../../../../website/content/docs/*.*.*.md"], { query: "?raw", import: "default", eager: true });
const images = import.meta.glob<string>("../../../../website/public/docs/**/*.{webp,png,jpg}", { query: "?url", import: "default", eager: true });

const isPage = (id: string): id is GuidePageId => (GUIDE_PAGE_IDS as readonly string[]).includes(id);

/** The action a guide link performs, or null when the Guide cannot follow it. */
export function guideLink(href: string, page?: GuidePageId): string | null {
  const [path = "", anchor] = href.split("#");
  if (href.startsWith("settings:")) {
    try {
      settingsLinkTarget(href.slice("settings:".length));
      return href;
    } catch { return null; }
  }
  if (!path) return anchor && page ? `guide:${page}#${anchor}` : null;
  const docs = /^\$docs\.(.+)$/u.exec(path);
  if (docs) {
    const guide = GUIDE_PAGE_IDS.find((id) => PAGE_NAMES[id] === docs[1]);
    if (guide) return `guide:${guide}${anchor ? `#${anchor}` : ""}`;
    if (FEATURE_PAGES.has(docs[1]!)) return `feature:${docs[1]}`;
    return `url:${WEBSITE}/docs/${docs[1]}${anchor ? `#${anchor}` : ""}`;
  }
  const url = path.startsWith("/") ? new URL(href, WEBSITE) : URL.canParse(href) ? new URL(href) : null;
  return url && url.protocol === "https:" && LAUNCHER_GUIDE_ORIGINS.has(url.origin) ? `url:${url.href}` : null;
}

export function parseGuideAction(actionId: string): GuideAction | null {
  if (actionId.startsWith("url:")) return { kind: "url", url: actionId.slice(4) };
  if (actionId.startsWith("settings:")) {
    return { kind: "settings", target: settingsLinkTarget(actionId.slice("settings:".length)) };
  }
  const feature = /^feature:([\w-]+)$/u.exec(actionId);
  if (feature && FEATURE_PAGES.has(feature[1]!)) return { kind: "feature", id: FEATURE_PAGES.get(feature[1]!)!, url: `${WEBSITE}/docs/${feature[1]}` };
  const guide = /^guide:([\w-]+)(?:#(.+))?$/u.exec(actionId);
  if (guide && isPage(guide[1]!)) return guide[2] ? { kind: "guide", page: guide[1], anchor: guide[2] } : { kind: "guide", page: guide[1] };
  return null;
}

/** The page's Markdown as the website stores it. */
export function guideSource(id: GuidePageId): string {
  // `hub` is docs/<n>.hub.md: the website drops the order prefix.
  const path = Object.keys(sources).find((candidate) => candidate.replace(/^.*\/(?:\d+\.)?/u, "") === `${PAGE_NAMES[id]}.md`);
  if (!path) throw new Error(`guide page ${id} is missing`);
  return sources[path]!;
}

function page(id: GuidePageId): GuidePage {
  const { fields, body } = readFrontMatter(guideSource(id));
  return {
    id,
    title: fields.navTitle || fields.title!,
    summary: fields.description ?? "",
    blocks: parseMarkdown(body, {
      link: (href) => guideLink(href, id),
      image: (src) => images[`${IMAGE_DIRECTORY}${src}`] ?? null,
    }, 200),
  };
}

export const GUIDE_PAGES: readonly GuidePage[] = GUIDE_PAGE_IDS.map(page);
