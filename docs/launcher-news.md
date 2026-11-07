# Launcher news and release notes

The website Markdown files are the one source of truth for GWonMac release notes and curated event stories. The website renders the full article and generates the launcher's small static feed at `website/public/launcher/news-v1.json`.

Keep the `news-v1.json` format unchanged: installed older apps read it, and it carries the announcement that tells their players to download the new app.

## Publish a GWonMac release note

Every release gets one post in `website/content/en/2.blog`. That post is the changelog: the website shows it, the launcher shows it under **GWonMac** in the news list, and the Discord announcement is a copy of it. The GitHub release keeps only the technical record.

### Frontmatter

```yaml
---
title: GWonMac 1.0.0
description: Restores every GWonMac feature after the large Guild Wars update of October 22. Nothing else changes.
badge: Release
date: 2026-10-23
readingTime: 1 min read
author: authors/matamo
launcherId: gwonmac-1-0-0
launcherSource: launcher
launcherChannel: stable
launcherFeatured: true
---
```

- `title` is `GWonMac` and the version, nothing else.
- `description` repeats the summary paragraph. The launcher shows it under the title, so it must stand alone. Keep it under 360 characters; the generator refuses longer text.
- Set `launcherFeatured: true` only on the newest release, and set it back to `false` on the post it replaces.

### Body

```md
Restores every GWonMac feature after the large Guild Wars update of October 22. Nothing else changes.

- **Compatibility:** Tools, Quick Travel, Xunlai Chest and the skill overlays work again with the new client.
- **Settings → Tools:** a new option is named in bold, with where to find it and what it does.

## Known issues

- Adrenaline skill icons can flicker. This also happens in ArenaNet's phone app.

[Technical release record](https://github.com/gwonmac/gwonmac/releases/tag/v1.0.0){target="_blank"}
```

1. **Summary paragraph first.** One to three sentences: what is different for the player and why it matters. Lead with the biggest change. If a release only restores compatibility, say so plainly.
2. **One bullet per change**, most noticeable first. Start with the place or feature in bold, then say what the player sees now: "now …", "no longer …". Name where to find it (`Settings → Display`) and its shortcut (`⌘T`).
3. **Player words only.** Describe what changed in the game, not how: no PR numbers, proofs, certification, refactors, or release tooling. If players cannot notice a change, leave it out.
4. **Optional sections**, in this order and only when they have content: `## Known issues`, `## Notes`. Notes are for things players must do or know, for example "Restart Guild Wars once after the update."
5. **End with the technical record link.**

The Markdown subset is paragraphs, `##` headings, bullet lists, bold text, inline code, links, and images. Images must be stored under `website/public` and referenced with a website-relative path. The launcher renders this safe subset as native Vue elements; it never injects HTML.

### Announce it

Post the title, the body, and the website link in Discord's announcements channel. Do not write a separate Discord text: edit the post instead, so the website, the launcher, and Discord say the same thing.

## Publish an important event

Use the same blog workflow with:

```yaml
launcherId: guild-wars-pirate-week-2026
launcherSource: event
launcherChannel: all
launcherFeatured: true
launcherExternalUrl: https://wiki.guildwars.com/wiki/Pirate_Week
launcherStartsAt: 2026-09-13T19:00:00Z
launcherEndsAt: 2026-09-20T19:00:00Z
```

Curate only events that help players plan. The launcher fetches ordinary game update notes directly from the Guild Wars Wiki, so do not copy those into the website.

## Validate before publishing

Run:

```sh
pnpm --dir website generate:launcher-news
pnpm --dir website check
```

Commit the Markdown and regenerated JSON together. The check fails for duplicate IDs, unsupported fields, invalid channels, a summary over 360 characters, or a stale generated feed. The feed carries the newest 24 posts; older posts stay on the website.

## Runtime behavior

- Electron main fetches only the exact GWonMac feed and Guild Wars Wiki API URLs.
- Guild Wars Wiki cards show the first player-facing update item with its section name. Page headings, Wiki maintenance notes, and build metadata stay out of the preview.
- Responses and images have byte limits and strict origin/type checks.
- The last valid GWonMac feed is cached for offline use.
- The renderer receives typed content and opaque story IDs, never arbitrary navigation or fetch access.
- Source visibility and automatic rotation are presentation preferences stored in `launcher-state.json`.

## Release notes and the Guide inside the app

The launcher bundles two parts of the website at build time, so they work offline and match the installed version:

- **What's new.** The release post whose `launcherId` is `gwonmac-<version with dashes>` is bundled with that version. After an update, the launcher opens it once as an article in **News**. Write the next release's post with `draft: true` in its frontmatter: the website and the news feed leave a draft out, but the app build includes it. Remove `draft: true` when you publish the release.
- **Guide.** The pages listed in `PAGE_PATHS` (`app/ui/launcher/src/guide.ts`) become **Help**: the feature pages in `website/content/en/1.docs/4.features`, plus Build templates, Performance, Troubleshooting, and Known issues from `1.guides`. `7.known-issues.md` is also the Known issues list. Install and mobile linking stay on the website.
- **Links.** `:setting[Label]{to="<section>/<control>"}` opens that setting in the launcher and shows as bold text on the website; the IDs come from `app/shared/settings-catalogue.ts`. It is an inline component, not a link: the website's render policy refuses any link that is not https, mailto, tel, or a relative path. `$docs/features/<page>` and `$docs/guides/<page>` open the Guide page when the Guide has it, otherwise the website.
- **Media.** Images must be under `website/public/docs` (Guide) or `website/public/blog` (release notes). A screenshot or video that is still to be made is written as a placeholder, shown as a dashed box in both places:

  ```md
  ::media-placeholder{type="video"}
  Switch Character from an outpost. 10 s.
  ::
  ```

`app/ui/launcher/src/guide.test.ts` fails when a Guide link or image does not resolve. Game updates in News come from the wiki page source of the five newest `Feedback:Game updates/` pages and are shown in full.
