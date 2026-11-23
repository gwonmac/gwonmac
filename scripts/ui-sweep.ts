/**
 * The UI sweep (docs/ui-sweep.md): opens every launcher scene, Hub view and in-game panel in a
 * headless browser at three window sizes, runs the layout rules in tests/ui-sweep/audit.ts, and
 * writes one screenshot per scene plus a contact sheet to test-results/ui-sweep/. It fails on any
 * finding that tests/ui-sweep/allowed.json does not name with a reason. Headless: it opens no
 * window and takes no focus, so it may run locally.
 *   pnpm ui:sweep                 every surface
 *   pnpm ui:sweep hub overlays    only these surfaces
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";
import { auditLayout, type AuditFinding } from "../tests/ui-sweep/audit.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "test-results/ui-sweep");
// Vite is a dependency of the UI packages, not of the root, so the root project cannot see its
// types; this is the part of its API the sweep uses.
type ViteDevServer = Readonly<{ listen(): Promise<unknown>; close(): Promise<void>; httpServer: { address(): AddressInfo | string | null } | null }>;
type ViteOptions = Readonly<{ root: string; configFile: string | false; appType?: "mpa" }>;
const { createServer } = createRequire(path.join(root, "app/ui/tools/package.json"))("vite") as {
  createServer(options: ViteOptions & Readonly<{ logLevel: "error"; server: object }>): Promise<ViteDevServer>;
};

type Viewport = Readonly<{ width: number; height: number }>;
// The smallest size each window allows (app/main/window.ts, app/main/accounts-window.ts), then two common ones.
const GAME_VIEWPORTS: readonly Viewport[] = [{ width: 800, height: 600 }, { width: 1280, height: 800 }, { width: 1920, height: 1080 }];
const LAUNCHER_VIEWPORTS: readonly Viewport[] = [{ width: 900, height: 640 }, { width: 1280, height: 800 }, { width: 1920, height: 1080 }];

type Scene = Readonly<{ name: string; path: string; open?(page: Page): Promise<void> }>;
type Surface = Readonly<{ id: string; viewports: readonly Viewport[]; ignore?: string; server(): Promise<string>; scenes: readonly Scene[] }>;

async function viteServer(options: ViteOptions): Promise<string> {
  const server = await createServer({ ...options, logLevel: "error", server: { host: "127.0.0.1", port: 0, strictPort: false } });
  await server.listen();
  servers.push(server);
  const address = server.httpServer?.address();
  if (!address || typeof address === "string") throw new Error("Vite gave no port");
  return `http://127.0.0.1:${address.port}`;
}
const servers: { close(): Promise<void> }[] = [];

const hubView = (command: string) => async (page: Page) => {
  // The fixture marks the zero-size #app once the Hub takes input (tests/hub-page.ts waits the same way).
  await page.locator("#app[data-ready=true]").waitFor({ state: "attached" });
  if (!command) return;
  const search = page.locator(".hub-search input");
  await search.fill(command);
  await search.press("Enter");
  await page.waitForTimeout(400);
};

const LAUNCHER_TABS = ["News", "Accounts", "Features", "Help", "Settings"];
const launcherTab = (tab: string) => async (page: Page) => {
  await page.getByRole("navigation").first().getByRole("button", { name: tab, exact: true }).or(page.getByRole("button", { name: tab, exact: true })).first().click();
  await page.waitForTimeout(300);
};

const LAUNCHER_SCENES = ["default", "accounts", "fresh", "preparing", "repair", "offline", "update", "failed", "features", "features-restart"];

const SURFACES: readonly Surface[] = [
  {
    id: "launcher",
    viewports: LAUNCHER_VIEWPORTS,
    server: () => viteServer({ root: path.join(root, "app/ui/launcher"), configFile: path.join(root, "app/ui/launcher/vite.config.ts") }),
    scenes: [
      ...LAUNCHER_SCENES.map((scene) => ({ name: scene, path: `/?fixture=${scene}` })),
      ...LAUNCHER_TABS.map((tab) => ({ name: `tab-${tab.toLowerCase()}`, path: "/?fixture=features", open: launcherTab(tab) })),
    ],
  },
  {
    id: "hub",
    viewports: GAME_VIEWPORTS,
    // The fixture's own buttons along the bottom edge stand in for the game, not the Hub.
    ignore: ".hub-fixture-controls",
    server: () => viteServer({ root: path.join(root, "app/ui/tools"), configFile: path.join(root, "app/ui/tools/vite.config.ts") }),
    scenes: [
      { name: "home", path: "/?hub", open: hubView("") },
      { name: "travel", path: "/?hub", open: hubView("travel") },
      { name: "builds", path: "/?hub", open: hubView("builds") },
      { name: "party", path: "/?hub&party", open: hubView("team") },
      { name: "trade", path: "/?trade=1" },
    ],
  },
  {
    id: "overlays",
    viewports: GAME_VIEWPORTS,
    server: () => viteServer({ root, configFile: false, appType: "mpa" }),
    scenes: ["memory-low", "memory-critical", "quit", "compass-dock"].map((state) => ({
      name: state,
      path: `/tests/ui-sweep/overlays.html?state=${state}`,
      open: (page: Page) => page.locator("body[data-ready=true]").waitFor(),
    })),
  },
];

type Allowed = Readonly<{ surface: string; rule: string; target: string; reason: string }>;
type Row = Readonly<{ surface: string; scene: string; viewport: string; shot: string; findings: (AuditFinding & { allowed?: string })[]; error?: string }>;

const wanted = process.argv.slice(2);
const allowed = JSON.parse(await readFile(path.join(root, "tests/ui-sweep/allowed.json"), "utf8")) as Allowed[];
const allowedFor = (surface: string, finding: AuditFinding) => allowed.find((entry) => entry.surface === surface && entry.rule === finding.rule && finding.target.includes(entry.target));

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const rows: Row[] = [];
try {
  for (const surface of SURFACES.filter((entry) => wanted.length === 0 || wanted.includes(entry.id))) {
    const base = await surface.server();
    for (const viewport of surface.viewports) {
      const context = await browser.newContext({ viewport, colorScheme: "dark", reducedMotion: "reduce" });
      for (const scene of surface.scenes) {
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const size = `${viewport.width}x${viewport.height}`;
        const shot = `${surface.id}-${scene.name}-${size}.png`;
        let findings: Row["findings"] = [];
        try {
          await page.goto(base + scene.path, { waitUntil: "networkidle" });
          await scene.open?.(page);
          await page.evaluate(() => document.fonts.ready);
          findings = (await page.evaluate(auditLayout, surface.ignore ?? "")).map((finding) => {
            const entry = allowedFor(surface.id, finding);
            return entry ? { ...finding, allowed: entry.reason } : finding;
          });
        } catch (error) {
          errors.push(error instanceof Error ? error.message.split("\n")[0] ?? "" : String(error));
        }
        await page.screenshot({ path: path.join(out, shot) }).catch(() => {});
        rows.push({ surface: surface.id, scene: scene.name, viewport: size, shot, findings, ...(errors.length ? { error: errors.join("; ") } : {}) });
        await page.close();
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  await Promise.all(servers.map((server) => server.close()));
}

const failing = (row: Row) => row.error !== undefined || row.findings.some((finding) => !finding.allowed && finding.rule !== "truncated");
const escape = (text: string) => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
await writeFile(path.join(out, "report.json"), `${JSON.stringify(rows, null, 2)}\n`);
await writeFile(path.join(out, "index.html"), `<!doctype html><meta charset=utf-8><title>UI sweep</title>
<style>body{font:13px system-ui;background:#111;color:#ddd;margin:16px}figure{display:inline-block;vertical-align:top;margin:0 12px 18px 0;max-width:420px}
img{width:420px;border:1px solid #333}figcaption b{color:#fff}.bad{color:#ff8080}.ok{color:#8c8}.note{color:#999}</style>
${rows.map((row) => `<figure><a href="${row.shot}"><img src="${row.shot}" loading=lazy></a><figcaption><b>${row.surface} · ${row.scene}</b> ${row.viewport}
${row.error ? `<div class=bad>error: ${escape(row.error)}</div>` : ""}${row.findings.map((f) => `<div class=${f.allowed ? "note" : f.rule === "truncated" ? "note" : "bad"}>${f.rule}: ${escape(f.target)} (${escape(f.detail)})${f.allowed ? ` · allowed: ${escape(f.allowed)}` : ""}</div>`).join("")}
${failing(row) ? "" : "<div class=ok>clean</div>"}</figcaption></figure>`).join("\n")}`);

const bad = rows.filter(failing);
for (const row of bad) {
  console.log(`✗ ${row.surface} · ${row.scene} · ${row.viewport}`);
  if (row.error) console.log(`    error: ${row.error}`);
  for (const finding of row.findings.filter((f) => !f.allowed && f.rule !== "truncated")) console.log(`    ${finding.rule}: ${finding.target} (${finding.detail})`);
}
console.log(`${rows.length} scenes, ${bad.length} failing. Screenshots: ${path.relative(root, path.join(out, "index.html"))}`);
process.exitCode = bad.length ? 1 : 0;
