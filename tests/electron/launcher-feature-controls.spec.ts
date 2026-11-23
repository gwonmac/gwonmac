/** Feature pages, native shortcuts, and feature visibility agree through real IPC. */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { closeOffline, launchOffline, openFeaturePage, openFeatures, openSettings } from "./fixtures.mjs";

test("feature controls preserve preferences and validate native commands", async () => {
  const fixture = await launchOffline("gw-launcher-features-", { GW_TEST_RETURN_LAUNCHER: "1" });
  const page = fixture.page;
  try {
    await page.evaluate(async () => {
      await window.launcherNative.experience.completeSetup({ enableTools: false });
    });
    const settings = await openFeatures(fixture);
    // The plain game holds every Feature switch, Switch Character included, until it is turned off.
    await expect(settings.getByRole("switch", { name: "Play the plain game", exact: true })).toBeChecked();
    await expect(settings.getByRole("switch", { name: "Switch Character", exact: true })).toBeDisabled();
    await expect(settings.locator('[data-feature="cartography"]')).toHaveCount(1);
    await settings.evaluate(() => window.launcherNative.tools.setFeature({ tool: "character-switch", enabled: false }));
    await expect.poll(() => page.evaluate(async () => (await window.launcherNative.state.get()).tools.features["character-switch"].enabled)).toBe(false);
    await settings.evaluate(async () => {
      await window.launcherNative.tools.setFeature({ tool: "character-switch", enabled: true });
      await window.launcherNative.tools.replaceShortcut({ action: "character.switch", binding: { key: "j", shift: false, option: false } });
    });
    await openFeaturePage(settings, "characterSwitch");
    await expect(settings.locator(".feature-settings").getByText("⌘J", { exact: true })).toBeVisible();
    await settings.locator(".feature-page .back").click();
    await settings.evaluate(() => window.launcherNative.tools.setMasterEnabled(true));
    await expect(settings.getByRole("switch", { name: "Play the plain game", exact: true })).not.toBeChecked();
    await expect(settings.getByRole("switch", { name: "Switch Character", exact: true })).toBeEnabled();
    const resign = settings.getByRole("switch", { name: "Resign", exact: true });
    await expect(resign).not.toBeChecked();
    await resign.click();
    await expect(resign).toBeChecked();
    await settings.evaluate(() => window.launcherNative.tools.replaceShortcut({ action: "game.resign", binding: { key: "j", shift: true, option: false } }));
    await openFeaturePage(settings, "resign");
    await expect(settings.getByRole("button", { name: "Change Resign shortcut", exact: true }).locator("kbd")).toHaveText(["⇧", "⌘", "J"]);
    await settings.getByRole("button", { name: "Turn off", exact: true }).click();
    await expect(settings.getByRole("button", { name: "Turn on", exact: true })).toBeVisible();
    await settings.screenshot({ path: test.info().outputPath("resign-page.png") });
    await settings.locator(".feature-page .back").click();
    await openFeaturePage(settings, "cartography");
    await expect(settings.getByRole("heading", { name: "Exploration grid", exact: true, level: 1 })).toBeVisible();
    const shortcuts = await page.evaluate(async () => (await window.launcherNative.state.get()).shortcuts);
    expect(shortcuts["cartography.grid.toggle"]).toBeNull();
    expect(shortcuts["cartography.walkability.toggle"]).toBeNull();
    await settings.getByRole("switch", { name: "Markers on Compass", exact: true }).click();
    await expect(settings.getByRole("switch", { name: "Markers on Compass", exact: true })).toBeChecked();
    await settings.evaluate(() => window.launcherNative.tools.replaceShortcut({ action: "cartography.grid.toggle", binding: { key: "g", shift: false, option: false } }));
    await settings.screenshot({ path: test.info().outputPath("maps-page.png") });
    // Turning the grid off keeps its page and every choice on it.
    await settings.evaluate(() => window.launcherNative.tools.setFeature({ tool: "maps", enabled: false }));
    await expect(settings.getByRole("heading", { name: "Exploration grid", exact: true, level: 1 })).toBeVisible();
    await expect(settings.getByRole("switch", { name: "Markers on Compass", exact: true })).toBeChecked();
    const snapshot = await page.evaluate(() => window.launcherNative.state.get());
    expect(snapshot.settings.cartographyCompassGridEnabled).toBe(true);
    expect(snapshot.shortcuts["cartography.grid.toggle"]?.key).toBe("g");
    for (const bad of [
      () => settings.evaluate(() => window.launcherNative.tools.captureShortcut("unknown" as "travel.open")),
      () => settings.evaluate(() => window.launcherNative.tools.replaceShortcut({ action: "travel.open", binding: { key: "q", shift: false, option: false } })),
      () => settings.evaluate(() => window.launcherNative.settings.update({ skillKeyBindings: [] as never })),
    ]) await expect(bad()).rejects.toThrow();
  } finally { await closeOffline(fixture); }
});

test("the game menu follows the plain game, saved Character Switch enablement and bindings", async () => {
  // A session that starts in the plain game waits for a restart before any Feature runs, so this
  // one starts with Features loaded and turns the plain game on and off again.
  const fixture = await launchOffline("gw-feature-menu-", {}, userData =>
    writeFile(path.join(userData, "settings.json"), JSON.stringify({ gwonmacTools: true })));
  try {
    const launcher = fixture.app.windows().find(page => page.url().endsWith("launcher/index.html"));
    if (!launcher) throw new Error("launcher is required");
    const menu = () => fixture.app.evaluate(({ Menu }) => {
      const item = Menu.getApplicationMenu()?.getMenuItemById("switch-character");
      return item ? { enabled: item.enabled, accelerator: item.accelerator ?? null } : null;
    });
    await expect.poll(menu).toEqual({ enabled: true, accelerator: "Command+E" });
    // The plain game stops Character Switch with every other Feature.
    await launcher.evaluate(() => window.launcherNative.tools.setMasterEnabled(false));
    await expect.poll(menu).toEqual({ enabled: false, accelerator: "Command+E" });
    await launcher.evaluate(() => window.launcherNative.tools.setMasterEnabled(true));
    await expect.poll(menu).toEqual({ enabled: true, accelerator: "Command+E" });
    await launcher.evaluate(async () => {
      await window.launcherNative.tools.setFeature({ tool: "character-switch", enabled: false });
      await window.launcherNative.tools.replaceShortcut({ action: "character.switch", binding: { key: "j", shift: false, option: false } });
    });
    await expect.poll(menu).toEqual({ enabled: false, accelerator: "Command+J" });
    await launcher.evaluate(async () => {
      await window.launcherNative.tools.setFeature({ tool: "character-switch", enabled: true });
      await window.launcherNative.tools.replaceShortcut({ action: "character.switch", binding: null });
    });
    await expect.poll(menu).toEqual({ enabled: true, accelerator: null });
  } finally { await closeOffline(fixture); }
});

test("existing custom map styles can be selected, edited and extended", async () => {
  const fixture = await launchOffline("gw-existing-map-styles-", { GW_TEST_RETURN_LAUNCHER: "1" });
  const page = fixture.page;
  try {
    await page.evaluate(async () => {
      await window.launcherNative.experience.completeSetup({ enableTools: false });
    });
    const settings = await openFeatures(fixture, "cartography");
    await settings.evaluate(() => window.launcherNative.tools.setMasterEnabled(true));
    const compass = settings.getByRole("switch", { name: "Markers on Compass", exact: true });
    await expect(compass).not.toBeChecked();
    await settings.evaluate(() => window.launcherNative.tools.setFeature({ tool: "maps", enabled: true }));
    await compass.click();
    await expect(compass).toBeChecked();
    await compass.click();
    await expect(compass).not.toBeChecked();
    await expect.poll(() => page.evaluate(async () => (await window.launcherNative.state.get()).settings)).toMatchObject({ cartographyCompassGridEnabled: false });
    // The map style is shared by every map Feature, so it is in Settings › Appearance.
    await openSettings(fixture, { section: "appearance" });
    const thickness = settings.getByRole("spinbutton", { name: "Terrain border thickness value" });
    await thickness.fill("4");
    await thickness.press("Tab");
    await expect.poll(() => page.evaluate(async () => (await window.launcherNative.state.get()).settings.cartographyPresetLibrary.customPresets[0]?.style.walkability.boundaryWidth)).toBe(4);
    await settings.getByRole("button", { name: "Edit style" }).click();
    await expect(settings.getByRole("textbox", { name: "Shaded area color hex" })).toBeVisible();
    await settings.locator('select').filter({ has: settings.locator('option[value="builtin:cartographer"]') }).selectOption("builtin:synthwave");
    await expect(settings.getByRole("button", { name: "Customize style" })).toBeVisible();
    await settings.getByRole("button", { name: "Customize style" }).click();
    await expect.poll(() => page.evaluate(async () => (await window.launcherNative.state.get()).settings.cartographyPresetLibrary.customPresets.length)).toBe(2);
    await settings.getByRole("textbox", { name: "Shaded area color hex" }).fill("112233");
    await settings.getByRole("textbox", { name: "Shaded area color hex" }).press("Tab");
    await expect.poll(() => page.evaluate(async () => (await window.launcherNative.state.get()).settings.cartographyPresetLibrary.customPresets[1]?.style.walkability.veilColor)).toBe("#112233");
    await settings.reload();
    await openSettings(fixture, { section: "appearance" });
    await settings.getByRole("button", { name: "Edit style" }).click();
    await settings.getByRole("textbox", { name: "Terrain border color hex" }).fill("334455");
    await settings.getByRole("textbox", { name: "Terrain border color hex" }).press("Tab");
    await expect.poll(() => page.evaluate(async () => (await window.launcherNative.state.get()).settings.cartographyPresetLibrary.customPresets[1]?.style.walkability.boundaryColor)).toBe("#334455");
    await expect(settings.getByRole("spinbutton", { name: "Terrain border thickness value" })).toHaveValue("1");
    await settings.getByRole("button", { name: "Done", exact: true }).click();
    await settings.locator('[data-setting="cartographyPresetLibrary"]').scrollIntoViewIfNeeded();
    await settings.screenshot({ path: test.info().outputPath("map-controls.png") });
  } finally { await closeOffline(fixture); }
});

test("map styles offer usable color and numeric controls at normal size and 200% zoom", async () => {
  test.setTimeout(60_000);
  const fixture = await launchOffline("gw-settings-controls-", { GW_TEST_RETURN_LAUNCHER: "1" });
  const page = fixture.page;
  try {
    await page.evaluate(async () => {
      await window.launcherNative.experience.completeSetup({ enableTools: false });
    });
    await page.evaluate(() => window.launcherNative.tools.setMasterEnabled(true));
    const settings = await openSettings(fixture, { section: "appearance" });
    await settings.getByRole("button", { name: "Customize style" }).click();
    const hex = settings.getByRole("textbox", { name: "Shaded area color hex" });
    await hex.fill("ABCDEF");
    await hex.press("Tab");
    await expect.poll(() => page.evaluate(async () =>
      (await window.launcherNative.state.get()).settings.cartographyPresetLibrary.customPresets[0]?.style.walkability.veilColor,
    )).toBe("#ABCDEF");
    await settings.getByRole("spinbutton", { name: "Terrain border thickness value", exact: true }).fill("0");
    await settings.getByRole("spinbutton", { name: "Terrain border thickness value", exact: true }).press("Tab");
    await expect.poll(() => page.evaluate(async () =>
      (await window.launcherNative.state.get()).settings.cartographyPresetLibrary.customPresets[0]?.style.walkability.boundaryWidth,
    )).toBe(0);

    await settings.getByText("Inspection outlines", { exact: true }).click();
    for (const size of [
      { width: 1180, height: 900, zoom: 1 },
      { width: 900, height: 700, zoom: 1 },
      { width: 900, height: 700, zoom: 2 },
    ]) {
      await fixture.app.evaluate(({ BrowserWindow }, value) => {
        const win = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().endsWith("launcher/index.html"))!;
        win.webContents.setZoomFactor(value.zoom);
        win.setSize(value.width, value.height);
      }, size);
      await settings.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      await settings.locator(".map-style-editor").scrollIntoViewIfNeeded();
      const controls = settings.locator(".map-style-editor input, .map-style-editor select");
      // The resize and zoom above relayout the page asynchronously, so retry the whole read until it holds.
      await expect(async () => {
        for (const control of await controls.all()) {
          await control.scrollIntoViewIfNeeded();
          const box = await control.boundingBox();
          expect(box).not.toBeNull();
          // Desktop controls retain a 32px minimum target at every zoom level.
          expect(box!.width).toBeGreaterThanOrEqual(32);
          expect(box!.height).toBeGreaterThanOrEqual(32);
          expect(box!.x).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width).toBeLessThanOrEqual(await settings.evaluate(() => innerWidth));
          expect(await control.evaluate(el => el.hasAttribute("aria-label") || !!(el as HTMLInputElement).labels?.length)).toBe(true);
          expect(await control.evaluate(el => {
            const box = el.getBoundingClientRect();
            return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === el;
          })).toBe(true);
        }
        const clipped = await settings.locator(".map-style-editor").evaluate(el => el.scrollWidth > el.clientWidth + 1);
        expect(clipped).toBe(false);
      }).toPass();
      await hex.scrollIntoViewIfNeeded();
      // Electron's native capture preserves the window at non-default zoom.
      const capture = await fixture.app.evaluate(async ({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().endsWith("launcher/index.html"))!;
        return (await win.webContents.capturePage()).toPNG().toString("base64");
      });
      await writeFile(test.info().outputPath(`map-style-${size.width}-${size.zoom}x.png`), Buffer.from(capture, "base64"));
    }
    await fixture.app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().endsWith("launcher/index.html"))!;
      win.webContents.setZoomFactor(1);
      win.setSize(1180, 900);
    });
    await openSettings(fixture, { section: "appearance" });
    await settings.getByRole("combobox", { name: "Panel style", exact: true }).selectOption("custom");
    await settings.getByRole("textbox", { name: "Accent hex", exact: true }).fill("BBCCDD");
    await settings.getByRole("textbox", { name: "Accent hex", exact: true }).press("Tab");
    await expect.poll(() => page.evaluate(async () => (await window.launcherNative.state.get()).settings.uiCustomTheme.accent)).toBe("#BBCCDD");
    await settings.getByRole("combobox", { name: "Panel style", exact: true }).scrollIntoViewIfNeeded();
    await settings.screenshot({ path: test.info().outputPath("panel-appearance.png") });
  } finally { await closeOffline(fixture); }
});
