import { test, expect, type ElectronApplication } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';
import { createSessionFixture, createUserDataDir, launchElectronApp, openSeededRecentFolder, removeDir, seedRecentDirectory } from './electronHarness';

test('mixed library excludes sources, skips failed media, produces early previews and reuses cache', async () => {
  const profile = await createUserDataDir();
  const names = Array.from({ length: 20 }, (_, i) => `clip-${String(i).padStart(2, '0')}.mp4`);
  const { rootDir, mediaDir } = await createSessionFixture(names, 12);
  let app: ElectronApplication | undefined;
  try {
    await fs.writeFile(path.join(mediaDir, 'a-empty.mp4'), '');
    await fs.writeFile(path.join(mediaDir, 'b-broken.mp4'), 'not media');
    await fs.writeFile(path.join(mediaDir, 'source.ts'), 'export const test: number = 123;');
    await fs.writeFile(path.join(mediaDir, 'source.mts'), 'import fs from "node:fs";');
    await fs.mkdir(path.join(mediaDir, 'node_modules'));
    await fs.writeFile(path.join(mediaDir, 'node_modules', 'unwanted.mp4'), 'not media');
    await seedRecentDirectory(profile, mediaDir);
    app = await launchElectronApp(profile);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(900, 600));
    await app.evaluate(({ app }) => {
      const load = process.getBuiltinModule("module").createRequire(`${app.getAppPath()}/package.json`);
      const media = load("./electron/media-process.js");
      const trace: { probes: string[]; frames: string[]; probesAtFirstFrame?: number } = { probes: [], frames: [] };
      (globalThis as any).__performanceTrace = trace;
      const probe = media.probe;
      const frame = media.runFfmpeg;
      media.probe = (...args: any[]) => { trace.probes.push(args[0]); return probe(...args); };
      media.runFfmpeg = (...args: any[]) => {
        trace.probesAtFirstFrame ??= trace.probes.length;
        trace.frames.push(args[0][args[0].indexOf('-i') + 1]);
        return frame(...args);
      };
    });
    const page = await openSeededRecentFolder(app, names[0]);
    // Virtualisation means not every card is mounted; inspect the completed work via main-process trace.
    await expect.poll(() => app!.evaluate(() => (globalThis as any).__performanceTrace.frames.length)).toBe(120);
    await expect(page.getByText('Thumbnails created', { exact: true })).toBeVisible();
    const trace = await app.evaluate(() => (globalThis as any).__performanceTrace);
    expect(trace.probes).toHaveLength(21); // 20 videos + corrupt input; empty bypasses ffprobe.
    expect(trace.probesAtFirstFrame).toBeLessThan(21);
    expect(trace.frames.some((file: string) => /empty|broken|source|unwanted/.test(path.basename(file)))).toBe(false);
    expect(await page.getByText('source.ts', { exact: true }).count()).toBe(0);
    await app.close();
    app = await launchElectronApp(profile);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(900, 600));
    await app.evaluate(({ app }) => {
      const load = process.getBuiltinModule("module").createRequire(`${app.getAppPath()}/package.json`);
      const media = load("./electron/media-process.js");
      (globalThis as any).__unexpectedMediaWork = [];
      for (const name of ['probe', 'runFfmpeg']) {
        const original = media[name];
        media[name] = (...args: any[]) => {
          (globalThis as any).__unexpectedMediaWork.push(name);
          return original(...args);
        };
      }
    });
    const reopened = await openSeededRecentFolder(app, names[0]);
    const cachedCard = reopened.locator('.video-card').filter({ has: reopened.getByText(names[0], { exact: true }) });
    await cachedCard.scrollIntoViewIfNeeded();
    await expect(cachedCard.locator('.thumb-img-loaded')).toHaveCount(6);
    await expect(reopened.locator('.title-bar-status-pill')).toHaveCount(0);
    expect(await app.evaluate(() => (globalThis as any).__unexpectedMediaWork)).toEqual([]);
  } finally {
    if (app) await app.close();
    await removeDir(profile);
    await removeDir(rootDir);
  }
});
