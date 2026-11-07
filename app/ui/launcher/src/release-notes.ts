/**
 * The release notes of the installed version, read from its website post at
 * build time, so "What's new" works offline and matches this exact app. The
 * post may still be a draft: the news feed publishes it only at release.
 * Its links are Guide actions (see guide.ts), not news link IDs.
 */
import type { LauncherNewsStory } from "@shared/launcher-contracts";
import { parseMarkdown } from "@shared/launcher-markdown";
import { readFrontMatter } from "@shared/website-content";
import { guideLink } from "./guide";

const posts = import.meta.glob<string>("../../../../website/content/en/2.blog/*.md", { query: "?raw", import: "default", eager: true });
const images = import.meta.glob<string>("../../../../website/public/blog/**/*.{webp,png,jpg,gif}", { query: "?url", import: "default", eager: true });

export const releaseStoryId = (version: string) => `gwonmac-${version.replaceAll(".", "-")}`;

export function releaseNotesFor(version: string): LauncherNewsStory | null {
  const id = releaseStoryId(version);
  const post = Object.values(posts).map(readFrontMatter).find((candidate) => candidate.fields.launcherId === id);
  if (!post) return null;
  const { fields, body } = post;
  return {
    id,
    source: "launcher",
    channel: fields.launcherChannel === "beta" ? "beta" : "stable",
    title: fields.title ?? "",
    summary: fields.description ?? "",
    publishedAt: `${fields.date}T12:00:00Z`,
    featured: false,
    action: "article",
    body: parseMarkdown(body, { link: (href) => guideLink(href), image: (src) => images[`../../website/public${src}`] ?? null }, 200),
  };
}
