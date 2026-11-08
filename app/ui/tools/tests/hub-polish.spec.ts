import { expect, test } from '@playwright/test';
import { openHub } from './hub-page.js';

// The preview's content (heroes named, no template paths) is held in src/hub-polish.dom.test.ts.

for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 650 }, { width: 640, height: 480 }]) {
  test(`full team preview stays readable inside the frame at ${viewport.width}×${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await openHub(page);
    const search = page.locator('.hub-search input');
    await search.fill('team gom afk');
    const preview = page.locator('.hub-preview');
    await expect(preview).toBeVisible();
    await expect(page.locator('.hub-primary')).toBeInViewport();
    const boxes = await page.locator('.hub-panel, .hub-preview, .hub-footer').evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, overflow: element.scrollWidth - element.clientWidth };
    }));
    expect(boxes[1]!.bottom).toBeLessThanOrEqual(boxes[2]!.top + 1);
    expect(boxes[2]!.bottom).toBeLessThanOrEqual(boxes[0]!.bottom);
    expect(boxes.every(box => box.overflow <= 1)).toBe(true);
    await page.screenshot({ path: info.outputPath('team-preview.png') });
  });
}
