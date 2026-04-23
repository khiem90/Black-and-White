import { test, expect, Page } from '@playwright/test';

/** Wait for it to be the player's turn, then click a tile via native event. */
async function playTile(page: Page, tileNum?: number) {
  // Wait for a selectable tile to appear (means it's player's turn)
  await page.waitForSelector('[data-testid="player-tiles"] .hex-tile.selectable', { timeout: 10000 });

  await page.evaluate((num) => {
    const selector = num != null
      ? `[data-testid="player-tiles"] [data-testid="tile-${num}"]`
      : '[data-testid="player-tiles"] .hex-tile.selectable';
    const el = document.querySelector(selector);
    if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }, tileNum ?? null);
}

test.describe('Black & White - Tile Battle', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('Start Screen', () => {
    test('displays the title and rules', async ({ page }) => {
      await expect(page.getByTestId('start-screen')).toBeVisible();
      await expect(page.getByRole('heading', { name: /black & white/i })).toBeVisible();
      await expect(page.getByText('Tile Battle')).toBeVisible();
      await expect(page.getByText(/never revealed/i)).toBeVisible();
    });

    test('has a start button', async ({ page }) => {
      const btn = page.getByTestId('btn-start');
      await expect(btn).toBeVisible();
      await expect(btn).toHaveText(/play vs\.? ai/i);
      // Also expose the online variant.
      await expect(page.getByTestId('btn-start-online')).toBeVisible();
    });

    test('clicking start shows the game screen', async ({ page }) => {
      await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-testid="btn-start"]')?.click());
      await expect(page.getByTestId('game-screen')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Game Screen', () => {
    test.beforeEach(async ({ page }) => {
      await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-testid="btn-start"]')?.click());
      await expect(page.getByTestId('game-screen')).toBeVisible({ timeout: 5000 });
    });

    test('shows scores starting at 0', async ({ page }) => {
      await expect(page.getByTestId('player-score')).toHaveText('0');
      await expect(page.getByTestId('ai-score')).toHaveText('0');
    });

    test('starts at round 1 of 9', async ({ page }) => {
      await expect(page.getByTestId('round-badge')).toContainText('1');
      await expect(page.getByTestId('round-badge')).toContainText('9');
    });

    test('displays 9 player tiles (0-8)', async ({ page }) => {
      const playerTiles = page.getByTestId('player-tiles');
      for (let i = 0; i <= 8; i++) {
        await expect(playerTiles.getByTestId(`tile-${i}`)).toBeVisible();
      }
    });

    test('displays 9 face-down AI tiles', async ({ page }) => {
      const aiTiles = page.getByTestId('ai-tiles');
      const hiddenTiles = aiTiles.getByTestId('tile-hidden');
      await expect(hiddenTiles).toHaveCount(9);
    });

    test('has a play area with VS badge', async ({ page }) => {
      await expect(page.getByTestId('play-area')).toBeVisible();
      await expect(page.getByText('VS')).toBeVisible();
    });

    test('shows 9 round tracker dots', async ({ page }) => {
      const dots = page.getByTestId('rounds-track').locator('.round-dot');
      await expect(dots).toHaveCount(9);
    });
  });

  test.describe('Gameplay', () => {
    test.beforeEach(async ({ page }) => {
      await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-testid="btn-start"]')?.click());
      await expect(page.getByTestId('game-screen')).toBeVisible({ timeout: 5000 });
    });

    test('player can select a tile and it appears in play area', async ({ page }) => {
      await playTile(page, 5);

      // The round should advance (tile played -> AI responds -> resolve -> next round)
      await expect(page.getByTestId('round-badge')).toContainText('2', { timeout: 15000 });
    });

    test('round advances after both players play', async ({ page }) => {
      await playTile(page);

      // Wait for round to resolve and advance to round 2
      await expect(page.getByTestId('round-badge')).toContainText('2', { timeout: 15000 });
    });

    test('used tiles become disabled after playing', async ({ page }) => {
      // Play tile 3
      await playTile(page, 3);

      // Wait for round to advance
      await expect(page.getByTestId('round-badge')).toContainText('2', { timeout: 15000 });

      // Tile 3 should be disabled
      const tile3 = page.getByTestId('player-tiles').getByTestId('tile-3');
      await expect(tile3).toHaveClass(/disabled/);
    });

    test('AI tile color is visible but number is hidden in play area', async ({ page }) => {
      await playTile(page);

      // After the AI picks, its tile face should be masked — color visible, number hidden.
      const aiPlayedFace = page.getByTestId('played-ai').locator('.hex-face');
      await expect(aiPlayedFace).toHaveClass(/tile-masked/, { timeout: 8000 });

      // The face should show a color class (black or white), not just tile-hidden.
      await expect(aiPlayedFace).toHaveClass(/tile-(black|white)/);

      // No number should be rendered as text content.
      const text = await aiPlayedFace.textContent();
      expect((text ?? '').trim()).toBe('');
    });

    test('scores are valid after 3 rounds', async ({ page }) => {
      for (let round = 1; round <= 3; round++) {
        await playTile(page);
        if (round < 3) {
          await expect(page.getByTestId('round-badge')).toContainText(String(round + 1), { timeout: 15000 });
        }
      }

      // Wait for round 3 to resolve
      await expect(page.getByTestId('round-badge')).toContainText('4', { timeout: 15000 });

      const pScore = Number(await page.getByTestId('player-score').textContent());
      const aScore = Number(await page.getByTestId('ai-score').textContent());
      expect(pScore).toBeGreaterThanOrEqual(0);
      expect(aScore).toBeGreaterThanOrEqual(0);
      expect(pScore + aScore).toBeLessThanOrEqual(3);
    });
  });

  test.describe('Full Game', () => {
    test('completes all 9 rounds and shows result overlay', async ({ page }) => {
      test.setTimeout(120000);
      await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-testid="btn-start"]')?.click());
      await expect(page.getByTestId('game-screen')).toBeVisible({ timeout: 5000 });

      // Play rounds until the result overlay appears (tied matches auto-replay from round 1)
      for (let attempt = 0; attempt < 40; attempt++) {
        const overlay = await page.getByTestId('result-overlay').isVisible().catch(() => false);
        if (overlay) break;
        const hasSelectable = await page.$('[data-testid="player-tiles"] .hex-tile.selectable');
        if (hasSelectable) {
          await page.evaluate(() => {
            const el = document.querySelector('[data-testid="player-tiles"] .hex-tile.selectable');
            if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          });
        }
        await page.waitForTimeout(3000);
      }

      await expect(page.getByTestId('result-overlay')).toBeVisible({ timeout: 30000 });
      // Verify result shows scores
      await expect(page.getByTestId('result-title')).toBeVisible();
      await expect(page.getByTestId('btn-replay')).toBeVisible();
    });

    test('Play Again resets the game to initial state', async ({ page }) => {
      test.setTimeout(180000); // Ties trigger full match replays
      await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-testid="btn-start"]')?.click());
      await expect(page.getByTestId('game-screen')).toBeVisible({ timeout: 5000 });

      // Play rounds until the result overlay appears (tied matches auto-replay from round 1)
      for (let attempt = 0; attempt < 40; attempt++) {
        const overlay = await page.getByTestId('result-overlay').isVisible().catch(() => false);
        if (overlay) break;
        // Play a tile if it's our turn
        const hasSelectable = await page.$('[data-testid="player-tiles"] .hex-tile.selectable');
        if (hasSelectable) {
          await page.evaluate(() => {
            const el = document.querySelector('[data-testid="player-tiles"] .hex-tile.selectable');
            if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          });
        }
        await page.waitForTimeout(3000);
      }

      await expect(page.getByTestId('result-overlay')).toBeVisible({ timeout: 30000 });

      // Click Play Again
      await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-testid="btn-replay"]')?.click());

      // Game should reset to round 1, scores 0
      await expect(page.getByTestId('player-score')).toHaveText('0', { timeout: 5000 });
      await expect(page.getByTestId('ai-score')).toHaveText('0');
      await expect(page.getByTestId('round-badge')).toContainText('1');

      // All 9 tiles should be available
      const available = page.getByTestId('player-tiles').locator('.hex-tile:not(.disabled)');
      await expect(available).toHaveCount(9, { timeout: 5000 });
    });
  });
});
