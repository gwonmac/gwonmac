import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig, type Plugin } from "vite";

const settingsEntry = fileURLToPath(new URL("../launcher/src/hub-entry.ts", import.meta.url));
/**
 * The Hub fixture loads Settings as the game does, from `settings/settings-app.js`. In the dev
 * server that path is the launcher's source entry, so the fixture draws the same page.
 */
const hubSettingsModule: Plugin = {
  name: "gwonmac-hub-settings-module",
  apply: "serve",
  // vitest resolves the same lazy import through Vite rather than over HTTP, ahead of Vite's own
  // resolver, which would return the missing file's path unchanged.
  enforce: "pre",
  resolveId(source) {
    return source.endsWith("/settings/settings-app.js") ? settingsEntry : null;
  },
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      // The renderer imports it relative to its own module, so any folder may precede it.
      if (request.url?.split("?")[0]?.endsWith("/settings/settings-app.js")) request.url = `/@fs${settingsEntry}`;
      next();
    });
  },
};

export default defineConfig(({ mode }) => {
  const embedded = mode === "embedded";
  return {
    base: "./",
    plugins: [vue(), hubSettingsModule],
    // The Settings module loads on demand, so Vite's start-up scan would miss its dependencies and
    // reload the page mid-test when it found them; scan it with the page.
    optimizeDeps: { entries: ["index.html", settingsEntry] },
    // Library mode preserves dependency environment checks unless they are
    // defined explicitly. The sandboxed renderer intentionally has no Node
    // `process` global.
    define: embedded
      ? { "process.env.NODE_ENV": JSON.stringify("production") }
      : {},
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        // The launcher's Settings source, which the fixture serves as the Hub's Settings module.
        "@shared": fileURLToPath(new URL("../../shared", import.meta.url)),
      },
      dedupe: ["vue"],
    },
    build: embedded
      ? {
          emptyOutDir: true,
          outDir: fileURLToPath(
            new URL("../../../build/renderer/tools", import.meta.url),
          ),
          sourcemap: false,
          // Two entries share one Vue chunk: the Tools application, and the Hub's view, which
          // Core loads too, so it reaches no Tools code (src/hub/embedded.ts).
          lib: {
            entry: {
              "tools-app": fileURLToPath(new URL("./src/embedded.ts", import.meta.url)),
              "hub-app": fileURLToPath(new URL("./src/hub/embedded.ts", import.meta.url)),
            },
            formats: ["es"],
            fileName: (_format, name) => `${name}.js`,
            cssFileName: "tools-app",
          },
        }
      : {
          outDir: "dist",
          sourcemap: true,
        },
    test: {
      environment: "happy-dom",
      // The Hub links Settings' stylesheet; a test reads no CSS, so a link loads as an empty sheet.
      environmentOptions: { happyDOM: { settings: { disableCSSFileLoading: true, handleDisabledFileLoadingAsSuccess: true } } },
      // Node 25+ ships its own localStorage global, which hides happy-dom's window.localStorage.
      execArgv: ["--no-experimental-webstorage"],
      globals: true,
      include: ["src/**/*.test.ts"],
      // Every run takes a new order, so a test that leans on the one before it fails; rerun a
      // failure with the seed it prints (`--sequence.seed=<seed>`).
      sequence: { shuffle: true },
    },
  };
});
