import { expect, test } from "@playwright/test";

test.describe("öffentliche Startseite", () => {
  test("loads without requiring authentication", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/BahnDelay|Bahn Delay/i);
    await expect(page.locator("body")).toContainText(/BahnDelay|Verspätung|Zug|Reise/i);
  });

  test("offers a path to sign in without exposing protected content", async ({ page }) => {
    await page.goto("/");

    const signIn = page.getByRole("link", { name: /anmelden|einloggen|login|magic link/i });
    await expect(signIn).toBeVisible();

    const protectedMarkers = page.getByText(/meine reisen|meine reise|dashboard/i);
    await expect(protectedMarkers).toHaveCount(0);
  });
});
