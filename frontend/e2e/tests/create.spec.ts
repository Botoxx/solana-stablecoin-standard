import { test, expect } from "../fixtures/base.fixture";
import { SSS1_CONFIG, SSS2_CONFIG } from "../fixtures/account-factory";

test.describe("Create Stablecoin", () => {
  test("SSS-1 preset selected by default", async ({ page }) => {
    await page.goto("/create");
    await expect(page.getByRole("heading", { name: "Create Stablecoin" })).toBeVisible();
    await expect(page.getByText("SSS-1").first()).toBeVisible();
    await expect(page.getByText("Minimal").first()).toBeVisible();
  });

  test("clicking SSS-2 toggles preset and shows different features", async ({ page }) => {
    await page.goto("/create");
    await page.locator("button").filter({ hasText: "SSS-2" }).click();
    await expect(page.getByText("Compliant").first()).toBeVisible();
    await expect(page.getByText("Permanent Delegate").first()).toBeVisible();
  });

  test("submit disabled when name or symbol empty", async ({ page }) => {
    await page.goto("/create");
    const submitBtn = page.getByRole("button", { name: "Create Stablecoin" });
    await expect(submitBtn).toBeDisabled();

    await page.getByPlaceholder("My USD").fill("Test Coin");
    await expect(submitBtn).toBeDisabled();

    await page.getByPlaceholder("MUSD").fill("TST");
    await expect(submitBtn).toBeEnabled();
  });

  test("successful SSS-1 create shows success toast and navigates to dashboard", async ({ page, rpcMock }) => {
    rpcMock.setConfig(SSS1_CONFIG);
    await page.goto("/create");
    await page.getByPlaceholder("My USD").fill("Test Coin");
    await page.getByPlaceholder("MUSD").fill("TST");
    await page.getByRole("button", { name: "Create Stablecoin" }).click();

    // Wait for success (skip loading toast — mock resolves too fast to reliably catch it)
    await expect(page.getByText("Stablecoin created")).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({ timeout: 5000 });
  });

  test("SSS-2 create shows compliance extension badges on dashboard", async ({ page, rpcMock }) => {
    rpcMock.setConfig(SSS2_CONFIG);
    await page.goto("/create");
    await page.locator("button").filter({ hasText: "SSS-2" }).click();
    await page.getByPlaceholder("My USD").fill("Compliant USD");
    await page.getByPlaceholder("MUSD").fill("CUSD");
    await page.getByRole("button", { name: "Create Stablecoin" }).click();

    await expect(page.getByText("Stablecoin created")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Permanent Delegate").first()).toBeVisible();
    await expect(page.getByText("Transfer Hook").first()).toBeVisible();
  });
});
