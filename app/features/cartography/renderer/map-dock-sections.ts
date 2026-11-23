/**
 * Owns the Compass dock sections of the map Features: the in-game quick controls of Exploration
 * grid, Walking route and Compass ranges. Each section only draws saved settings and asks the dock
 * to save a change; turning a Feature on or off stays on its switch (Hub, launcher, shortcut).
 * Every choice here is also on the Feature's page.
 */
import type { RendererSettingsPatch } from "../../../shared/contracts.js";
import { CARTOGRAPHY_REVEAL_MODES } from "../../../shared/cartography-overlay.js";
import {
  COMPASS_RANGE_INDICATORS,
  COMPASS_RANGE_THEMES,
  compassRangeColor,
  type CompassRange,
} from "../../../shared/compass-ranges.js";
import { optionFor, REVEAL_MODE_OPTIONS } from "../../../shared/setting-copy.js";
import type { AppSettings } from "../../../shared/settings/index.js";
import type { CompassDockSection } from "./compass-dock.js";
import type { CartographyQaStatus } from "./live-evidence.js";

/** The opacities a slider previews live while it moves, before the change is saved. */
export type MapOpacityKey = "cartographyGridOpacity" | "cartographyWalkabilityOpacity" | CompassRange["opacitySetting"];

type SectionOptions = Readonly<{
  document: Document;
  save(patch: RendererSettingsPatch): void;
  preview(key: MapOpacityKey, value: number | null): void;
}>;

function toggle(document: Document, label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "compass-dock-toggle";
  button.textContent = label;
  return button;
}

/** A labelled opacity slider that previews while it moves and saves once on release. */
function slider(options: SectionOptions, label: string, key: MapOpacityKey) {
  const row = options.document.createElement("label");
  row.className = "compass-dock-field";
  const name = options.document.createElement("span");
  name.textContent = label;
  const input = options.document.createElement("input");
  input.type = "range"; input.min = "0"; input.max = "100"; input.step = "1";
  input.setAttribute("aria-label", `${label} opacity`);
  const output = options.document.createElement("output");
  row.append(name, input, output);
  input.addEventListener("input", () => {
    output.value = `${input.value}%`;
    options.preview(key, Number(input.value));
  });
  input.addEventListener("change", () => {
    options.preview(key, null);
    options.save({ [key]: Number(input.value) });
  });
  return Object.freeze({
    row,
    input,
    sync(value: number) {
      if (options.document.activeElement !== input) input.value = String(value);
      output.value = `${input.value}%`;
    },
    close() { options.preview(key, null); },
  });
}

export type GridDockSection = CompassDockSection & Readonly<{ setAvailability(status: CartographyQaStatus): void }>;

function gridSection(options: SectionOptions): GridDockSection {
  const { document } = options;
  const body = document.createElement("div");
  const notice = document.createElement("p");
  notice.className = "compass-dock-notice";
  notice.hidden = true;
  const opacity = slider(options, "Opacity", "cartographyGridOpacity");
  const reachRow = document.createElement("label");
  reachRow.className = "compass-dock-field";
  reachRow.dataset.kind = "choice";
  const reachName = document.createElement("span");
  reachName.textContent = "Reveal";
  const reach = document.createElement("select");
  reach.setAttribute("aria-label", "Reveal range");
  for (const { value, compact } of REVEAL_MODE_OPTIONS) reach.add(new Option(compact, value));
  reachRow.append(reachName, reach);
  body.append(notice, opacity.row, reachRow);
  reach.addEventListener("change", () => {
    const value = optionFor(CARTOGRAPHY_REVEAL_MODES, reach.value);
    if (value) options.save({ cartographyRevealMode: value });
  });
  return Object.freeze({
    id: "grid",
    title: "Exploration grid",
    body,
    sync(settings: AppSettings) {
      opacity.sync(settings.cartographyGridOpacity);
      reach.value = settings.cartographyRevealMode;
    },
    close: opacity.close,
    setAvailability(status: CartographyQaStatus) {
      const available = status.continent.status === "ready";
      const limited = status.continent.status === "unavailable" && status.continent.reason === "unsupported-area";
      notice.hidden = !limited;
      notice.textContent = limited ? "No exploration progress in this area." : "";
      const reason = available ? "" : limited ? "Unavailable in this area" : "Temporarily unavailable";
      for (const control of [opacity.input, reach]) {
        control.disabled = !available;
        control.title = reason;
      }
    },
  });
}

function routeSection(options: SectionOptions): CompassDockSection {
  const { document } = options;
  const body = document.createElement("div");
  const hint = document.createElement("p");
  hint.className = "compass-dock-hint";
  hint.textContent = "Right-click the Mission Map or World Map to set a target.";
  const terrain = toggle(document, "Walkable terrain");
  const opacity = slider(options, "Terrain", "cartographyWalkabilityOpacity");
  let shaded = false;
  terrain.addEventListener("click", () => options.save({ cartographyOverlayEnabled: !shaded }));
  body.append(hint, terrain, opacity.row);
  return Object.freeze({
    id: "route",
    title: "Walking route",
    body,
    sync(settings: AppSettings) {
      shaded = settings.cartographyOverlayEnabled;
      terrain.setAttribute("aria-pressed", String(shaded));
      opacity.input.disabled = !shaded;
      opacity.sync(settings.cartographyWalkabilityOpacity);
    },
    close: opacity.close,
  });
}

function rangesSection(options: SectionOptions): CompassDockSection {
  const { document } = options;
  const body = document.createElement("div");
  const themes = document.createElement("div");
  themes.className = "compass-dock-choices";
  themes.setAttribute("role", "group");
  themes.setAttribute("aria-label", "Range colors");
  const themeButtons = COMPASS_RANGE_THEMES.map((theme) => {
    const button = toggle(document, theme === "color" ? "Color" : "Monochrome");
    button.addEventListener("click", () => options.save({ compassRangeTheme: theme }));
    themes.append(button);
    return { theme, button };
  });
  const list = document.createElement("div");
  list.className = "compass-dock-ranges";
  let saved: AppSettings | null = null;
  const rows = COMPASS_RANGE_INDICATORS.map((range) => {
    const row = document.createElement("div");
    row.className = "compass-dock-range";
    const button = toggle(document, "");
    const swatch = document.createElement("span");
    swatch.className = "compass-dock-swatch";
    const label = document.createElement("span");
    label.textContent = range.label;
    button.append(swatch, label);
    button.addEventListener("click", () => {
      if (saved !== null) options.save({ [range.enabledSetting]: !saved[range.enabledSetting] });
    });
    const opacity = slider(options, range.label, range.opacitySetting);
    // The row's toggle names the range, so the slider shows no second label.
    opacity.row.firstElementChild?.remove();
    row.append(button, opacity.row);
    list.append(row);
    return { range, row, button, opacity };
  });
  body.append(themes, list);
  return Object.freeze({
    id: "ranges",
    title: "Compass ranges",
    body,
    sync(settings: AppSettings) {
      saved = settings;
      for (const { theme, button } of themeButtons) button.setAttribute("aria-pressed", String(settings.compassRangeTheme === theme));
      for (const { range, row, button, opacity } of rows) {
        button.setAttribute("aria-pressed", String(settings[range.enabledSetting]));
        // The row carries the ring's colour: its swatch, its border when on, and its slider.
        row.style.setProperty("--compass-range-color", compassRangeColor(range, settings.compassRangeTheme));
        opacity.sync(settings[range.opacitySetting]);
      }
    },
    close() { for (const { opacity } of rows) opacity.close(); },
  });
}

/** One instance of each section for the life of the overlay; the overlay picks which to show. */
export function createMapDockSections(options: SectionOptions) {
  return Object.freeze({
    grid: gridSection(options),
    route: routeSection(options),
    ranges: rangesSection(options),
  });
}
