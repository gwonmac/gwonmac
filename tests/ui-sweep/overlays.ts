/**
 * Owns the UI sweep's in-game panel scenes. Each scene drives the production module with stand-in
 * actions, on the production markup taken from app/renderer/index.html, so the sweep sees what a
 * player sees. Scenes: `?state=memory-low`, `memory-critical`, `quit`, `compass-dock`.
 */
import { bindMemoryWarning } from "../../app/renderer/memory-warning.js";
import { createCompassDock } from "../../app/features/cartography/renderer/compass-dock.js";
import { createMapDockSections } from "../../app/features/cartography/renderer/map-dock-sections.js";
import { DEFAULT_SETTINGS, type AppSettings } from "../../app/shared/settings/index.js";

const GIB = 1024 ** 3;

async function mountRendererMarkup(ids: readonly string[]): Promise<void> {
  const html = await (await fetch("/app/renderer/index.html")).text();
  const source = new DOMParser().parseFromString(html, "text/html");
  for (const id of ids) {
    const element = source.getElementById(id);
    if (!element) throw new Error(`app/renderer/index.html has no #${id}`);
    document.body.append(document.importNode(element, true));
  }
}

function memoryWarning() {
  const presenter = bindMemoryWarning(document, {
    position: DEFAULT_SETTINGS.memoryWarningPosition,
    savePosition: async () => {},
    autoRelogAfterReload: true,
    saveAutoRelog: async () => {},
    reload: () => {},
    quit: () => {},
    covered: () => false,
  });
  if (!presenter) throw new Error("the memory panel markup is incomplete");
  return presenter;
}

const scenes: Record<string, () => Promise<void>> = {
  async "memory-low"() {
    await mountRendererMarkup(["memory-notice"]);
    const panel = memoryWarning();
    panel.update(1.6 * GIB, 2 * GIB);
    panel.present("low", 2 * GIB);
  },
  async "memory-critical"() {
    await mountRendererMarkup(["memory-notice"]);
    const panel = memoryWarning();
    panel.update(1.9 * GIB, 2 * GIB);
    panel.present("critical", 2 * GIB);
  },
  async quit() {
    await mountRendererMarkup(["memory-notice"]);
    const panel = memoryWarning();
    panel.update(0.5 * GIB, 2 * GIB);
    panel.open();
  },
  async "compass-dock"() {
    let settings: AppSettings = { ...DEFAULT_SETTINGS, cartographyGridEnabled: true, cartographyRouteEnabled: true, compassRangeIndicatorsEnabled: true };
    const dock = createCompassDock({ parent: document.body, persist: async (patch) => (settings = { ...settings, ...patch }) });
    const sections = createMapDockSections({ document, save: (patch) => dock.save(patch), preview: () => {} });
    const size = Math.min(220, window.innerWidth * 0.18);
    dock.update({
      compass: { left: window.innerWidth - size - 12, top: 12, width: size, height: size },
      settings,
      accent: null,
      sections: [sections.grid, sections.route, sections.ranges],
    });
    document.querySelector<HTMLButtonElement>(".compass-dock-trigger")?.click();
  },
};

const scene = scenes[new URLSearchParams(location.search).get("state") ?? ""];
if (!scene) throw new Error(`unknown scene; one of ${Object.keys(scenes).join(", ")}`);
await scene();
document.body.dataset.ready = "true";
