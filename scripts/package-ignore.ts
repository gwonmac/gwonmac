/**
 * What the packaged app ships, as one allowlist of archive-rooted paths, and
 * the copy filter Forge derives from it. The packaged-app inventory proof
 * (tests/helpers/package-inventory.ts) reads the same list.
 */
export const SHIPPED_PATHS = Object.freeze({
  // Compiled trees, copied whole except source maps and declarations.
  // build/features holds each feature's manifest and main-process part; the
  // main runtime imports them through app/features/main-parts.ts.
  compiled: ["/build/main", "/build/client", "/build/shared", "/build/features", "/build/renderer"],
  // Production modules, copied whole. The main process imports the `ws`
  // client at runtime. Cartography evidence previews are encoded in the main
  // process with pngjs, which is dependency-free: only its runtime ships.
  modules: ["/node_modules/ws", "/node_modules/pngjs/lib"],
  files: [
    "/package.json",
    "/node_modules/pngjs/package.json",
    "/build/preload/preload-core.cjs",
    "/build/preload/preload-tools.cjs",
    "/build/preload/preload-launcher.cjs",
    "/build/native/host.node",
    "/build/native/gw-dat-decode",
  ],
});

const roots = [...SHIPPED_PATHS.compiled, ...SHIPPED_PATHS.modules, ...SHIPPED_PATHS.files];
const inside = (p: string, tree: string) => p === tree || p.startsWith(`${tree}/`);

/** True when Forge must not copy this repository path (leading "/" optional). */
export function ignorePackageFile(file: string): boolean {
  if (!file || file === "/") return false;
  const p = file.startsWith("/") ? file : `/${file}`;
  // A directory that leads to a shipped path. Forge never descends into a
  // directory the filter rejected, so node_modules itself must be admitted.
  if (roots.some((root) => root.startsWith(`${p}/`))) return false;
  if (SHIPPED_PATHS.compiled.some((tree) => inside(p, tree))) {
    return p.endsWith(".map") || p.endsWith(".d.ts");
  }
  return !SHIPPED_PATHS.modules.some((tree) => inside(p, tree)) && !SHIPPED_PATHS.files.includes(p);
}
