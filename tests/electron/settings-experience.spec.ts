/** Settings stay understandable through save failures, navigation, and zoom. */
import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { launchOffline, closeOffline, openFeatures, openSettings } from "./fixtures.mjs";

test("a refused map edit says so on the Exploration grid page and keeps the saved choice at 200%", async () => {
  const fixture = await launchOffline("gw-settings-recovery-", { GW_TEST_RETURN_LAUNCHER: "1" });
  const page = fixture.page;
  try {
    await page.evaluate(async () => {
      await window.launcherNative.experience.completeSetup({ enableTools: false });
    });
    const settings = await openFeatures(fixture, "cartography");
    await expect(settings.locator(".feature-head").getByText("Off while you play the plain game.", { exact: true })).toBeVisible();
    await fixture.app.evaluate(({ ipcMain, BrowserWindow }) => {
      ipcMain.removeHandler("gw:launcher:settings:update");
      ipcMain.handle("gw:launcher:settings:update", () => { throw new Error("offline fixture save refusal"); });
      const win = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().endsWith("launcher/index.html"))!;
      win.setSize(900, 640);
      win.webContents.setZoomFactor(2);
    });
    const opacity = settings.getByRole("spinbutton", { name: "Grid opacity value" });
    await opacity.fill("40"); await opacity.press("Tab");
    // The Features tab's save status says the change was not saved and offers Retry; it has no Revert, because its controls show the saved value.
    const feedback = settings.locator(".features-status [role=alert]");
    await expect(feedback).toContainText("could not be saved");
    // The resize and zoom above can relayout the page after a first scroll, so scroll until it holds.
    await expect.poll(async () => {
      await feedback.scrollIntoViewIfNeeded();
      return feedback.evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
    }).toBe(true);
    const png = await fixture.app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().endsWith("launcher/index.html"))!;
      return (await win.webContents.capturePage()).toPNG().toString("base64");
    });
    await writeFile(test.info().outputPath("save-failure-200.png"), Buffer.from(png, "base64"));
    // A switch shows the saved choice, so a refused change leaves it as it was.
    const markers = settings.getByRole("switch", { name: "Markers on Compass", exact: true });
    await markers.click();
    await expect(markers).not.toBeChecked();
    expect((await page.evaluate(() => window.launcherNative.state.get())).settings.cartographyCompassGridEnabled).toBe(false);
  } finally { await closeOffline(fixture); }
});

test("settings navigation has one scroll owner and compact controls at supported sizes", async () => {
  test.setTimeout(60_000);
  const fixture = await launchOffline("gw-settings-layout-", { GW_TEST_RETURN_LAUNCHER: "1" });
  const page = fixture.page;
  try {
    await page.evaluate(async () => {
      await window.launcherNative.experience.completeSetup({ enableTools: false });
      // Feature shortcuts (opened below) can change only outside the plain game.
      await window.launcherNative.tools.setMasterEnabled(true);
    });
    const settings = await openSettings(fixture);
    for (const size of [{ width: 1180, height: 760, zoom: 1 }, { width: 900, height: 640, zoom: 1 }, { width: 1180, height: 760, zoom: 2 }, { width: 900, height: 640, zoom: 2 }]) {
      await fixture.app.evaluate(({ BrowserWindow }, size) => {
        const win = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().endsWith("launcher/index.html"))!;
        win.setSize(size.width, size.height); win.webContents.setZoomFactor(size.zoom);
      }, size);
      for (const section of ["Appearance", "Game", "Texture packs", "Game files", "Updates", "Home screen", "Advanced"]) {
        await settings.locator(".settings-page aside").getByRole("button", { name: section, exact: true }).click();
        await expect.poll(() => settings.locator(".settings-content").evaluate(el => el.scrollTop)).toBe(0);
        const heading = settings.locator(".settings-content h1");
        // A click on a section keeps the keyboard on its button; only a programmatic open moves it to the heading.
        await expect(settings.locator(".settings-page aside").getByRole("button", { name: section, exact: true })).toBeFocused();
        // The resize and zoom above relayout the page asynchronously, so poll until the layout holds.
        await expect.poll(() => heading.evaluate(el => { const r = el.getBoundingClientRect(); const p = el.closest(".settings-content")!.getBoundingClientRect(); return r.top >= p.top && r.bottom <= p.bottom; })).toBe(true);
        await expect.poll(() => settings.locator("main").evaluate(el => el.scrollHeight > el.clientHeight + 1)).toBe(false);
        const png = await fixture.app.evaluate(async ({ BrowserWindow }) => {
          const win = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().endsWith("launcher/index.html"))!;
          return (await win.webContents.capturePage()).toPNG().toString("base64");
        });
        await writeFile(test.info().outputPath(`${section.replaceAll(" ", "-")}-${size.width}-${size.zoom}.png`), Buffer.from(png,"base64"));
        await settings.locator(".settings-content").evaluate(el => { el.scrollTop = el.scrollHeight; });
      }
    }
    // A Feature's shortcut menu, on its page in the Features tab, opens on top and closes with Escape.
    await fixture.app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().endsWith("launcher/index.html"))!;
      win.setSize(1180, 760); win.webContents.setZoomFactor(1);
    });
    await openFeatures(fixture, "travel");
    const options = settings.locator(".feature-settings .shortcut-options").first();
    await options.locator("summary").click();
    const clear = options.getByRole("button", { name: /Clear .* shortcut/ });
    await expect(clear).toBeVisible();
    await expect.poll(() => clear.evaluate(el => { const r = el.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el; })).toBe(true);
    const menuPng = await fixture.app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().endsWith("launcher/index.html"))!;
      return (await win.webContents.capturePage()).toPNG().toString("base64");
    });
    await writeFile(test.info().outputPath("shortcut-options.png"), Buffer.from(menuPng, "base64"));
    await options.locator("summary").press("Escape");
    await expect(clear).not.toBeVisible();
  } finally { await closeOffline(fixture); }
});
