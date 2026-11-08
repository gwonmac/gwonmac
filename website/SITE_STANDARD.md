# Site standard record

- **Standard:** lupinum-website (commit `7b0da3f`, 2026-10-22)
- **Adoption level:** L1 open: `check-launch.mjs` has not run against production yet (see the adoption log).
- **Stage:** Live
- **Production URL:** https://www.gwonmac.com
- **Owner at Lupinum:** Matthias · **Client contact:** none (own project)

## Adoption log

- 2026-11-08 L1 started with the move to Ginko 0.16. This record written; `check-launch.mjs` ran only against the local build in preview mode: 16 pass, 3 fail, 1 warn, 6 skip. Open from that run: SEO-10 (the docs layer links `/blog/rss.xml`, which answers 404), SEO-01 (`/blog` and `/de/blog` share the title "Blog · GWonMac"), PERF-02 (images without width or height). SEO-04 listed all 55 sitemap pages, most likely because a preview answers every page with `x-robots-tag: noindex`; production must confirm it. Next: run it against production after the deploy and list its failed items as open here.
- 2026-11-08 Ginko 0.16.4. In the local production build, `/blog/rss.xml` and `/de/blog/rss.xml` answer 200 with an RSS feed (the German one has no items, because there are no German posts), so SEO-10 should pass on the next production run. An old English path under `/de` (`/de/docs/guides/install`) now answers 404 instead of an empty page; the old German paths still redirect.

## Profile

Flags from lupinum-website `standards/done.md`. One line of reason for each flag that is set.

| Flag | Set | Reason |
| --- | --- | --- |
| `local` | no | An app for players everywhere; no place or region. |
| `relaunch` | no | Same site and domain; old URLs keep working through `redirects.ts`. |
| `languages` | yes | English and German (`/de`). |
| `forms` | no | No form sends data. |
| `editorial` | yes | Player docs and a blog that grow with each release. |
| `cms` | no | Content is Markdown in this repository; we edit it. |
| `commerce` | no | The app is free; nothing is sold or booked. |
| `bafg` | no | No consumer sale or service under the BaFG. |
| `cookies` | no | Plausible only. |
| `maintained` | no | Own project; no maintenance agreement. |

## Launch evidence

Only `agent` and `manual` items. Format: `ID state date — what proves it`. States: `proven`, `failed`, `unverified`, `n/a`. An applicable item that isn't listed is open.

- None recorded yet.

## Exceptions

Departures from a rule or checklist item. Each has a reason and who decided. Security and legal items need Matthias's explicit OK.

- **F-03 (site facts):** facts stay in `site.json`, read by `ginko.config.ts`, `app/app.config.ts` and the home page. Moving them to `app/site.config.ts` was outside the Ginko 0.16 move. Proposed; needs Matthias's decision.
- **F-09 (prerender):** pages render on the server with Ginko's ISR, and `/download` is a live 302 to the newest DMG. `ginko check` and `pnpm test:website` catch broken links and moved URLs instead of a prerender crawl. Proposed; needs Matthias's decision.
