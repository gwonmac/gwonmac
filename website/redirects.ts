// Old addresses of the website, one hop each: the docs moved from nested folders (/docs/guides/install,
// /de/dokumentation/anleitungen/installation) to one flat list per language (/docs/install, /de/docs/installation).
// Read by ginko.config.ts (`redirects`); Ginko answers them before any page renders. 301 unless a rule says otherwise.
import type { Redirect } from '@lupinum/ginko'

export const redirects: Redirect[] = [
  // The app's Help menu opens /docs. The layer would answer it with a 302 to the first page; this keeps it one
  // permanent hop. Update it if another page becomes the first one.
  { from: '/docs', to: '/docs/install' },
  // The old German docs address goes straight to the first German page (/de/docs would add a second hop).
  { from: '/de/dokumentation', to: '/de/docs/installation' },
  { from: '/docs/guides/install', to: '/docs/install' },
  { from: '/docs/guides/accounts', to: '/docs/accounts' },
  { from: '/docs/guides/play-guild-wars-on-mac', to: '/docs/play-guild-wars-on-mac' },
  { from: '/docs/guides/performance', to: '/docs/performance' },
  { from: '/docs/guides/templates', to: '/docs/templates' },
  { from: '/docs/guides/troubleshooting', to: '/docs/troubleshooting' },
  { from: '/docs/guides/known-issues', to: '/docs/known-issues' },
  { from: '/docs/project/safety', to: '/docs/safety' },
  { from: '/docs/project/about', to: '/docs/about' },
  { from: '/docs/upstream/introduction', to: '/docs/upstream-requests' },
  { from: '/docs/upstream/request-summary', to: '/docs/request-summary' },
  { from: '/docs/upstream/filesystem/unimplemented-routines', to: '/docs/unimplemented-routines' },
  { from: '/docs/upstream/filesystem/path-remove-extension', to: '/docs/path-remove-extension' },
  { from: '/docs/upstream/filesystem/file-open-mode', to: '/docs/file-open-mode' },
  { from: '/docs/upstream/input/double-click-flag', to: '/docs/double-click-flag' },
  { from: '/docs/upstream/input/key-labels', to: '/docs/key-labels' },
  { from: '/docs/upstream/input/cursor-re-evaluation', to: '/docs/cursor-re-evaluation' },
  { from: '/docs/upstream/runtime/heap-maximum', to: '/docs/heap-maximum' },
  { from: '/docs/upstream/proposals/build-identification', to: '/docs/build-identification' },
  { from: '/docs/upstream/proposals/platform-host-interface', to: '/docs/platform-host-interface' },
  { from: '/docs/upstream/reference/our-workarounds', to: '/docs/our-workarounds' },
  { from: '/docs/upstream/reference/verification-method', to: '/docs/verification-method' },
  { from: '/docs/features/accounts', to: '/docs/accounts-and-launcher' },
  { from: '/docs/features/hub', to: '/docs/hub' },
  { from: '/docs/features/travel-and-maps', to: '/docs/travel-and-maps' },
  { from: '/docs/features/chat-and-trade', to: '/docs/chat-and-trade' },
  { from: '/docs/features/inventory', to: '/docs/inventory' },
  { from: '/docs/features/combat', to: '/docs/combat' },
  { from: '/docs/features/appearance', to: '/docs/appearance' },
  { from: '/docs/features/game-files-and-updates', to: '/docs/game-files-and-updates' },
  { from: '/de/dokumentation/anleitungen/installation', to: '/de/docs/installation' },
  { from: '/de/dokumentation/anleitungen/konten', to: '/de/docs/konten' },
  { from: '/de/dokumentation/anleitungen/guild-wars-auf-dem-mac-spielen', to: '/de/docs/guild-wars-auf-dem-mac-spielen' },
  { from: '/de/dokumentation/anleitungen/leistung', to: '/de/docs/leistung' },
  { from: '/de/dokumentation/anleitungen/templates', to: '/de/docs/templates' },
  { from: '/de/dokumentation/anleitungen/fehlerbehebung', to: '/de/docs/fehlerbehebung' },
  { from: '/de/dokumentation/projekt/sicherheit', to: '/de/docs/sicherheit' },
  { from: '/de/dokumentation/projekt/ueber', to: '/de/docs/ueber' },
  // English-only pages: the old German address showed the English text, so it leads to the English page.
  { from: '/de/dokumentation/guides/known-issues', to: '/docs/known-issues' },
  { from: '/de/dokumentation/upstream/filesystem/file-open-mode', to: '/docs/file-open-mode' },
  { from: '/de/dokumentation/upstream/filesystem/path-remove-extension', to: '/docs/path-remove-extension' },
  { from: '/de/dokumentation/upstream/filesystem/unimplemented-routines', to: '/docs/unimplemented-routines' },
  { from: '/de/dokumentation/upstream/input/cursor-re-evaluation', to: '/docs/cursor-re-evaluation' },
  { from: '/de/dokumentation/upstream/input/double-click-flag', to: '/docs/double-click-flag' },
  { from: '/de/dokumentation/upstream/input/key-labels', to: '/docs/key-labels' },
  { from: '/de/dokumentation/upstream/introduction', to: '/docs/upstream-requests' },
  { from: '/de/dokumentation/upstream/proposals/build-identification', to: '/docs/build-identification' },
  { from: '/de/dokumentation/upstream/proposals/platform-host-interface', to: '/docs/platform-host-interface' },
  { from: '/de/dokumentation/upstream/reference/our-workarounds', to: '/docs/our-workarounds' },
  { from: '/de/dokumentation/upstream/reference/verification-method', to: '/docs/verification-method' },
  { from: '/de/dokumentation/upstream/request-summary', to: '/docs/request-summary' },
  { from: '/de/dokumentation/upstream/runtime/heap-maximum', to: '/docs/heap-maximum' },
  // The old sitemap index and its per-language children; Ginko writes one sitemap with the language alternates.
  { from: '/sitemap_index.xml', to: '/sitemap.xml' },
  { from: '/__sitemap__/en-US.xml', to: '/sitemap.xml' },
  { from: '/__sitemap__/de-DE.xml', to: '/sitemap.xml' },
  // Ginko serves the text for AI agents at /llms.txt and /llms-full.txt only.
  { from: '/de/llms.txt', to: '/llms.txt' },
  { from: '/de/llms-full.txt', to: '/llms-full.txt' },
  // Download buttons and links on German pages; /download stays a live redirect to the newest DMG.
  { from: '/de/download', to: '/download', status: 302 },
  // The posts are English only and the layer lists a language's own posts, so the German header's Blog link would
  // open an empty list. Temporary (302): delete this rule when the first German post exists.
  { from: '/de/blog', to: '/blog', status: 302 },
]
