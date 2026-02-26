import { test, expect } from "../fixtures/base.fixture";
import { nav } from "../helpers/selectors";

test.describe("Navigation", () => {
  test("sidebar links navigate to correct pages", async ({ page }) => {
    await page.goto("/");

    await page.locator(nav.create).click();
    await expect(page).toHaveURL("/create");

    await page.locator(nav.load).click();
    await expect(page).toHaveURL("/load");

    await page.locator(nav.operations).click();
    await expect(page).toHaveURL("/operations");

    await page.locator(nav.roles).click();
    await expect(page).toHaveURL("/roles");

    await page.locator(nav.compliance).click();
    await expect(page).toHaveURL("/compliance");

    await page.locator(nav.dashboard).click();
    await expect(page).toHaveURL("/");
  });

  test("dashboard shows empty state when no stablecoin loaded", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("No stablecoin loaded")).toBeVisible();
  });

  test("empty state 'Create new' navigates to /create", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Create new" }).click();
    await expect(page).toHaveURL("/create");
  });

  test("empty state 'Load existing' navigates to /load", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Load existing" }).click();
    await expect(page).toHaveURL("/load");
  });

  test("operations page shows empty state without stablecoin", async ({ page }) => {
    await page.goto("/operations");
    await expect(page.getByText("Load or create a stablecoin first")).toBeVisible();
  });
});
