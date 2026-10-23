import { test, expect, type ElectronApplication } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';
import { createSessionFixture, createUserDataDir, launchElectronApp, openSeededRecentFolder, removeDir, seedRecentDirectory } from './electronHarness';

test('Mac workflow: six previews, keep/delete/skip, undo, Command keys, close/reopen and persisted decisions', async () => {
  test.skip(process.platform !== 'darwin');
  const profile = await createUserDataDir();
  const { rootDir, mediaDir } = await createSessionFixture(['alpha.mp4', 'beta.mp4', 'gamma 中文 #3.mp4'], 12);
  await seedRecentDirectory(profile, mediaDir);
  let app: ElectronApplication | undefined;
  try {
    app = await launchElectronApp(profile);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(900, 600));
    let page = await openSeededRecentFolder(app);
    // Cards load previews near the viewport; verify each card after scrolling to it.
    for (const name of ['alpha.mp4', 'beta.mp4', 'gamma 中文 #3.mp4']) {
      const card = page.locator('.video-card').filter({ has: page.getByText(name, { exact: true }) });
      await card.scrollIntoViewIfNeeded();
      await expect(card.locator('.thumb-img-loaded')).toHaveCount(6);
    }
    await page.getByText('alpha.mp4').click();
    await expect(page.locator('.review-thumbs .thumb-img-loaded')).toHaveCount(6);
    // Chromium-delivered Command combinations must never leak into plain decision keys.
    await page.keyboard.press('Meta+d');
    await expect(page.locator('.review-filename')).toHaveText('alpha.mp4');
    await page.keyboard.press('k');
    await expect(page.locator('.review-filename')).toHaveText('beta.mp4');
    await page.keyboard.press('d');
    await expect(page.locator('.review-filename')).toHaveText('gamma 中文 #3.mp4');
    await page.keyboard.press('z');
    await expect(page.locator('button[title="Show delete videos"]')).toContainText('0');
    await page.locator('.review-actions').getByRole('button', { name: /^Skip/ }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('button[title="Show keep videos"]')).toContainText('1');
    await expect(page.locator('button[title="Show skipped videos"]')).toContainText('1');

    // Red window button preserves the live session; Dock activation shows the same window.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    await expect.poll(() => app!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible())).toBe(false);
    await app.evaluate(({ app }) => app.emit('activate'));
    await expect.poll(() => app!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible())).toBe(true);
    await expect(page.locator('button[title="Show keep videos"]')).toContainText('1');

    // Verify the native menu command and its Mac accelerator. Physical Command+K is checked in the app UI; injected Chromium keys do not dispatch Cocoa menu accelerators.
    const accelerator = await app.evaluate(({ Menu, BrowserWindow }) => {
      const item = Menu.getApplicationMenu()?.getMenuItemById('View > Command Palette');
      if (!item) throw new Error('Command Palette menu item is missing');
      item.click(undefined, BrowserWindow.getAllWindows()[0], {});
      return item.accelerator;
    });
    expect(accelerator).toBe('CmdOrCtrl+K');
    await expect(page.getByRole('dialog', { name: 'Quick open' })).toBeVisible();
    await page.keyboard.press('Escape');

    await fs.mkdir('artifacts/mac-preview', { recursive: true });
    await page.screenshot({ path: 'artifacts/mac-preview/grid.png' });
    await app.close();
    app = await launchElectronApp(profile);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(900, 600));
    page = await openSeededRecentFolder(app);
    await expect(page.locator('button[title="Show keep videos"]')).toContainText('1');
    await expect(page.locator('button[title="Show skipped videos"]')).toContainText('1');
    for (const name of ['alpha.mp4', 'beta.mp4', 'gamma 中文 #3.mp4']) {
      const card = page.locator('.video-card').filter({ has: page.getByText(name, { exact: true }) });
      await card.scrollIntoViewIfNeeded();
      await expect(card.locator('.thumb-img-loaded')).toHaveCount(6);
    }
    await page.getByText('gamma 中文 #3.mp4').click();
    await page.locator('.review-actions').getByRole('button', { name: /^Play/ }).click();
    const video = page.locator('.review-video-skin video');
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.duration)).toBe(12);
    await video.evaluate((el: HTMLVideoElement) => { el.pause(); el.currentTime = 6; });
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeCloseTo(6);
    await page.screenshot({ path: 'artifacts/mac-preview/playback.png' });
    // Mark-only workflow never deletes originals.
    for (const name of ['alpha.mp4', 'beta.mp4', 'gamma 中文 #3.mp4']) await fs.access(path.join(mediaDir, name));
  } finally {
    if (app) await app.close();
    await removeDir(profile);
    await removeDir(rootDir);
  }
});
