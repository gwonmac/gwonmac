# gwonmac website

The Nuxt site behind https://www.gwonmac.com: the home page, the player docs,
the blog, and the small server routes and static files that installed apps and
players use. It is the `gw-website` package in this pnpm workspace and deploys
to Vercel from `main` (`vercel.json`).

## What it serves

| Path | Source | Who reads it |
| --- | --- | --- |
| `/` | `app/pages/index.vue` | players |
| `/docs/...` | `content/en/1.docs` (Ginko Docs) | players, and the launcher's Guide |
| `/blog/...` | `content/en/2.blog` | players, News in the launcher, "What's new" |
| `/download` | `server/routes/download.get.ts` | the newest DMG, for download buttons |
| `/api/latest` | `server/api/latest.get.ts` | the newest downloadable release, as JSON |
| `/launcher/news-v1.json` | generated from the blog | News in every installed app |
| `/updates/stable/darwin/arm64/RELEASES.json` | redirect to GitHub (`vercel.json`) | the app's update check |

`server/utils/release-select.ts` imports the app's own release rules from
`../app/shared`, so the website never copies them. Vercel rebuilds when this
folder or `app/shared` changes.

## Content the app bundles

The launcher builds parts of this folder into the app, so they work offline and
match the installed version:

- the Guide pages listed in `app/ui/launcher/src/guide.ts`;
- the release post whose `launcherId` is `gwonmac-<version>`, as "What's new";
- `public/launcher/news-v1.json` is fetched live, not bundled. Its format is
  frozen: released apps read it. `scripts/generate-launcher-news.mjs` builds it
  and checks it with the app's own parser (`app/shared/launcher-news-feed.ts`).

All three read front matter with `app/shared/website-content.ts`. How to write a
release post or event: [docs/launcher-news.md](../docs/launcher-news.md).

## Languages

English is complete. German (`content/de`) has 8 of the English docs pages:
six guides (install, accounts, playing on Mac, performance, templates,
troubleshooting) and two project pages (security, about). The features pages,
known issues, the upstream reports and the blog are English only.

## Commands

From the repository root:

```bash
pnpm --dir website dev                     # local site
pnpm --dir website generate:launcher-news  # rebuild news-v1.json after a blog change
pnpm --dir website check                   # lint, typecheck, and the news feed check
pnpm test:website                          # certify the build output and run the smoke test
```
