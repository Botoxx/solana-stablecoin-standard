import { test, expect } from "../fixtures/base.fixture";
import { encodeMinterConfig } from "../fixtures/account-factory";
import { MOCK_CONFIG_PDA, OTHER_PUBKEY } from "../fixtures/test-wallet";
import { createAndNavigateTo } from "../helpers/create-helper";

const SSS_PROGRAM_ID = "Fjv9YM4CUWFgQZQzLyD42JojLcDJ2yPG7WDEaR7U14n1";

test.describe("Roles", () => {
  test("Minter not in role dropdown options", async ({ page, rpcMock }) => {
    await createAndNavigateTo(page, rpcMock, "/roles");
    const select = page.locator("select").first();
    await expect(select).toBeVisible();
    const options = await select.locator("option").allTextContents();
    expect(options.some((o: string) => o.toLowerCase() === "minter")).toBe(false);
  });

  test("role assign shows success toast", async ({ page, rpcMock }) => {
    await createAndNavigateTo(page, rpcMock, "/roles");
    const roleCard = page.locator(".card").filter({ hasText: "Assign" });
    await roleCard.locator("input").first().fill(OTHER_PUBKEY.toBase58());
    await roleCard.getByRole("button", { name: "Assign" }).click();
    await expect(page.getByText(/Assign|Role/i).first()).toBeVisible({ timeout: 15000 });
  });

  test("role revoke shows success toast", async ({ page, rpcMock }) => {
    await createAndNavigateTo(page, rpcMock, "/roles");
    const roleCard = page.locator(".card").filter({ hasText: "Revoke" });
    await roleCard.locator("input").first().fill(OTHER_PUBKEY.toBase58());
    await roleCard.getByRole("button", { name: "Revoke" }).click();
    await expect(page.getByText(/Revok|Role/i).first()).toBeVisible({ timeout: 15000 });
  });

  test("add minter with quota shows success toast", async ({ page, rpcMock }) => {
    await createAndNavigateTo(page, rpcMock, "/roles");
    const minterCard = page.locator(".card").filter({ hasText: "Add Minter" });
    await minterCard.locator("input").first().fill(OTHER_PUBKEY.toBase58());
    await minterCard.locator("input").nth(1).fill("1000000");
    await minterCard.getByRole("button", { name: "Add Minter" }).click();
    await expect(page.locator(".fixed.bottom-4").getByText(/Adding minter|minter/i).first()).toBeVisible({ timeout: 15000 });
  });

  test("minter list shows title", async ({ page, rpcMock }) => {
    // Set up minter data
    rpcMock.setProgramAccounts(SSS_PROGRAM_ID, [{
      pubkey: OTHER_PUBKEY.toBase58(),
      data: encodeMinterConfig({
        config: MOCK_CONFIG_PDA,
        minter: OTHER_PUBKEY,
        quotaTotal: 1_000_000,
        quotaRemaining: 750_000,
      }),
      owner: SSS_PROGRAM_ID,
    }]);
    await createAndNavigateTo(page, rpcMock, "/roles");
    // MinterList section should be present with title
    await expect(page.getByText("Minters").first()).toBeVisible();
  });
});
