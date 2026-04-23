import { test, expect, Browser, Page } from '@playwright/test';

/**
 * Multiplayer smoke tests.
 *
 * These tests use two browser contexts to simulate two players connecting via
 * the PeerJS public broker. WebRTC + a third-party service can be flaky in CI,
 * so these are marked as `@multiplayer` and the whole suite is skippable via
 * TEST_SKIP_MULTIPLAYER=1.
 */

const SKIP = process.env.TEST_SKIP_MULTIPLAYER === '1';

test.describe('Multiplayer (PvP)', () => {
  test.skip(SKIP, 'Multiplayer tests skipped (set TEST_SKIP_MULTIPLAYER=0 to enable).');

  test.describe('Start screen', () => {
    test('shows a Play Online button', async ({ page }) => {
      await page.goto('/');
      const btn = page.getByTestId('btn-start-online');
      await expect(btn).toBeVisible();
      await expect(btn).toHaveText(/play online/i);
    });

    test('clicking Play Online shows the lobby with a share URL', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() =>
        document.querySelector<HTMLButtonElement>('[data-testid="btn-start-online"]')?.click()
      );
      await expect(page.getByTestId('lobby-screen')).toBeVisible({ timeout: 8000 });
      const input = page.getByTestId('share-url');
      await expect(input).toBeVisible();
      // The share URL should include a room= param once Peer opens.
      await expect(input).toHaveValue(/\?room=mm-[a-f0-9]{8}/, { timeout: 15000 });
    });
  });

  test.describe('Full connection', () => {
    test('host and guest connect, each sees the game board', async ({ browser }) => {
      test.setTimeout(60000);

      const { hostPage, guestPage } = await openTwoPlayers(browser);

      // Both should land on the game screen.
      await expect(hostPage.getByTestId('game-screen')).toBeVisible({ timeout: 20000 });
      await expect(guestPage.getByTestId('game-screen')).toBeVisible({ timeout: 20000 });

      // Both should start at Round 1/9, scores 0.
      await expect(hostPage.getByTestId('round-badge')).toContainText('1');
      await expect(guestPage.getByTestId('round-badge')).toContainText('1');
      await expect(hostPage.getByTestId('player-score')).toHaveText('0');
      await expect(guestPage.getByTestId('player-score')).toHaveText('0');

      // Exactly one of the two should have the "it's your turn" status.
      const hostStatus = (await hostPage.getByTestId('status-text').textContent()) ?? '';
      const guestStatus = (await guestPage.getByTestId('status-text').textContent()) ?? '';
      const hostFirst = /select a tile/i.test(hostStatus);
      const guestFirst = /select a tile/i.test(guestStatus);
      expect(hostFirst || guestFirst).toBe(true);
      expect(hostFirst && guestFirst).toBe(false);

      await hostPage.context().close();
      await guestPage.context().close();
    });

    test('a round plays end-to-end across both clients', async ({ browser }) => {
      test.setTimeout(60000);

      const { hostPage, guestPage } = await openTwoPlayers(browser);
      await expect(hostPage.getByTestId('game-screen')).toBeVisible({ timeout: 20000 });
      await expect(guestPage.getByTestId('game-screen')).toBeVisible({ timeout: 20000 });

      // Play one round: whoever goes first picks a tile, other responds.
      await playOneRound(hostPage, guestPage);

      // Both sides should have advanced to round 2.
      await expect(hostPage.getByTestId('round-badge')).toContainText('2', { timeout: 15000 });
      await expect(guestPage.getByTestId('round-badge')).toContainText('2', { timeout: 15000 });

      // The score totals (p + a) across both perspectives should match (either a point was scored or a tie).
      const hostP = Number(await hostPage.getByTestId('player-score').textContent());
      const hostA = Number(await hostPage.getByTestId('ai-score').textContent());
      const guestP = Number(await guestPage.getByTestId('player-score').textContent());
      const guestA = Number(await guestPage.getByTestId('ai-score').textContent());
      expect(hostP + hostA).toBe(guestP + guestA);
      // From the host's perspective, their p is the guest's a, and vice versa.
      expect(hostP).toBe(guestA);
      expect(hostA).toBe(guestP);

      await hostPage.context().close();
      await guestPage.context().close();
    });
  });
});

/** Bring up a host browser context + a guest browser context joined to the host's room. */
async function openTwoPlayers(browser: Browser): Promise<{ hostPage: Page; guestPage: Page }> {
  const hostContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  await hostPage.goto('/');
  await hostPage.evaluate(() =>
    document.querySelector<HTMLButtonElement>('[data-testid="btn-start-online"]')?.click()
  );
  // Wait for the share URL to be populated.
  const shareInput = hostPage.getByTestId('share-url');
  await expect(shareInput).toHaveValue(/\?room=mm-[a-f0-9]{8}/, { timeout: 20000 });
  const shareUrl = await shareInput.inputValue();

  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  await guestPage.goto(shareUrl);

  return { hostPage, guestPage };
}

/** Drive one round. Either side may go first — we inspect the status text. */
async function playOneRound(hostPage: Page, guestPage: Page) {
  async function waitForPlayerTurn(page: Page, timeout: number): Promise<boolean> {
    try {
      await page.waitForSelector('[data-testid="player-tiles"] .hex-tile.selectable', { timeout });
      return true;
    } catch {
      return false;
    }
  }
  async function clickFirstSelectable(page: Page) {
    await page.evaluate(() => {
      const el = document.querySelector(
        '[data-testid="player-tiles"] .hex-tile.selectable'
      );
      el?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }

  // Whoever's turn it is picks first.
  const hostTurn = await waitForPlayerTurn(hostPage, 5000);
  if (hostTurn) {
    await clickFirstSelectable(hostPage);
    // Now guest should become selectable.
    await waitForPlayerTurn(guestPage, 10000);
    await clickFirstSelectable(guestPage);
  } else {
    // Guest goes first.
    await waitForPlayerTurn(guestPage, 5000);
    await clickFirstSelectable(guestPage);
    await waitForPlayerTurn(hostPage, 10000);
    await clickFirstSelectable(hostPage);
  }
}
