import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Paths } from '../core/paths.js';

/** Save a PNG of the report's summary and flow, so a run can be shared as an image (PR comment, chat). */
export async function captureSummaryCard(p: Paths): Promise<string | null> {
  const html = join(p.out, 'index.html');
  if (!existsSync(html)) return null;
  const { chromium } = await import('@playwright/test');
  if (!existsSync(chromium.executablePath())) return null;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
    await page.goto(pathToFileURL(html).href);
    await page.waitForSelector('[data-card]', { timeout: 10_000 });
    await page.waitForTimeout(400);
    mkdirSync(join(p.out, 'cards'), { recursive: true });
    const out = join(p.out, 'cards', 'summary.png');
    await page.locator('[data-card]').screenshot({ path: out });
    return out;
  } finally {
    await browser.close();
  }
}
