// Checks the build output that ships as files: the head icons and the web manifest the pages name, and the SVGs.
// Pages, the sitemap and redirects are rendered by the server (Ginko renders on request and caches), so
// tests/website-smoke.ts checks them against the built server.
import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const output = join(import.meta.dirname, "..", ".output");
const publicDir = join(output, "public");

await access(join(output, "server", "index.mjs"));

// The files behind the head links of nuxt.config.ts (the smoke test checks the links in the rendered page).
for (const file of ["favicon-96x96.png", "favicon.ico", "apple-touch-icon.png", "site.webmanifest"]) {
  await access(join(publicDir, file));
}

const expectedManifestIcons = [
  {
    src: "/web-app-manifest-192x192.png",
    sizes: "192x192",
    type: "image/png",
    purpose: "maskable",
  },
  {
    src: "/web-app-manifest-512x512.png",
    sizes: "512x512",
    type: "image/png",
    purpose: "maskable",
  },
];
const manifest = JSON.parse(await readFile(join(publicDir, "site.webmanifest"), "utf8"));
if (JSON.stringify(manifest.icons) !== JSON.stringify(expectedManifestIcons)) {
  throw new Error("Generated web manifest does not contain the exact owned icon set");
}
await Promise.all(
  expectedManifestIcons.map(({ src }) => access(join(publicDir, src.slice(1)))),
);

const rasterDataUrl = /\b(?:href|xlink:href)\s*=\s*["']data:image\/(?!svg\+xml[;,])[a-z0-9.+-]+[;,]/iu;
for (const entry of await readdir(publicDir, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".svg")) continue;
  const svg = await readFile(join(entry.parentPath, entry.name), "utf8");
  if (rasterDataUrl.test(svg)) {
    throw new Error(
      `Generated SVG embeds raster image data: ${join(entry.parentPath, entry.name)}`,
    );
  }
}

console.info("Release output invariants passed.");
