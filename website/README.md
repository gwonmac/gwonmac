# gwonmac website

The Nuxt site behind https://www.gwonmac.com: the home page, the player docs,
the blog, and the small server routes and static files that installed apps and
players use. It is the `gw-website` package in this pnpm workspace and deploys
to Vercel from `main` (`vercel.json`).

## What it serves

| Path | Source | Who reads it |
| --- | --- | --- |
| `/` | `app/pages/index.vue` | players |
| `/docs/...` | `content/docs` (Ginko Docs) | players, and the launcher's Guide |
| `/blog/...` | `content/posts` and `content/authors` | players, News in the launcher, "What's new" |
| `/download` | `server/routes/download.get.ts` | the newest DMG, for download buttons |
| `/api/latest` | `server/api/latest.get.ts` | the newest downloadable release, as JSON |
| `/launcher/news-v1.json` | generated from the blog | News in every installed app |
| `/updates/stable/darwin/arm64/RELEASES.json` | redirect to GitHub (`vercel.json`) | the app's update check |

`ginko.config.ts` declares the site: its pages, the docs, posts and authors
bricks (with the launcher front matter on posts), the Markdown components, and
the redirects. `redirects.ts` keeps every old URL working with one 301 hop to
its new page. `app/app.config.ts` sets the header, banner, social links and
footer of the default Ginko Docs frame; `i18n/<code>.json` holds the banner
text.

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

English is complete. German pages live next to the English file as
`<name>.de.md` and answer under `/de/docs/<German slug>`. German has 8 of the
English docs pages: six guides (install, accounts, playing on Mac, performance,
templates, troubleshooting) and two project pages (security, about). The
features pages, known issues, the upstream reports and the blog are English
only; their old German URLs redirect to the English page.

## Commands

From the repository root:

```bash
pnpm --dir website dev                     # local site
pnpm --dir website generate:launcher-news  # rebuild news-v1.json after a blog change
pnpm --dir website check                   # lint, typecheck, ginko check (schema, links), news feed check
pnpm test:website                          # certify the build output and run the smoke test
```
