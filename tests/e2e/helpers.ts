import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * The auth forms are React islands (client:load). Filling or clicking before
 * hydration completes is a silent no-op (or gets wiped once React catches up
 * and re-renders from its own, still-empty, controlled state) — a well-known
 * SSR/islands race. The password-visibility toggle only has an effect once
 * hydrated, so retry-clicking it until it flips is a real wait-for-state gate,
 * not a fixed-time wait: each attempt is followed by a short state check, and
 * only success (or the final timeout) ends the loop.
 */
export async function waitForAuthFormHydration(page: Page) {
  const toggle = page.getByRole("button", { name: "Show password" }).first();
  const hydratedMarker = page.getByRole("button", { name: "Hide password" });

  for (let attempt = 0; attempt < 20; attempt++) {
    await toggle.click();
    try {
      await expect(hydratedMarker).toBeVisible({ timeout: 250 });
      return;
    } catch {
      // Not hydrated yet — the click was a no-op. Retry.
    }
  }

  // Final attempt: let it report the real, informative timeout error.
  await expect(hydratedMarker).toBeVisible();
}
