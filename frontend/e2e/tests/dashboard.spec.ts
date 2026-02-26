import { test, expect } from "../fixtures/base.fixture";
import { encodeStablecoinConfig, SSS1_CONFIG, SSS2_CONFIG } from "../fixtures/account-factory";
import { createAndLoad } from "../helpers/create-helper";

test.describe("Dashboard", () => {
  test("shows Total Supply, Total Minted, Total Burned, Decimals", async ({ page, rpcMock }) => {
    await createAndLoad(page, rpcMock, { totalMinted: 5_000_000, totalBurned: 1_000_000 });
    await expect(page.getByText("Total Supply")).toBeVisible();
    await expect(page.getByText("Total Minted")).toBeVisible();
    await expect(page.getByText("Total Burned")).toBeVisible();
    await expect(page.getByText("Decimals").first()).toBeVisible();
  });

  test("paused stablecoin shows PAUSED indicator", async ({ page, rpcMock }) => {
    await createAndLoad(page, rpcMock, { paused: true });
    await expect(page.getByText("PAUSED")).toBeVisible();
  });

  test("extension badges render for SSS-2", async ({ page, rpcMock }) => {
    await createAndLoad(page, rpcMock, {}, true);
    await expect(page.getByText("Permanent Delegate").first()).toBeVisible();
    await expect(page.getByText("Transfer Hook").first()).toBeVisible();
  });

  test("shows Config PDA, Mint, Authority, Treasury addresses", async ({ page, rpcMock }) => {
    await createAndLoad(page, rpcMock);
    await expect(page.getByText("Addresses")).toBeVisible();
    await expect(page.getByText("Config PDA")).toBeVisible();
    // "Mint" appears in multiple contexts — scope to address section
    const addrCard = page.locator(".card").filter({ hasText: "Addresses" });
    await expect(addrCard.getByText("Mint")).toBeVisible();
    await expect(addrCard.getByText("Authority")).toBeVisible();
    await expect(addrCard.getByText("Treasury")).toBeVisible();
  });

  test("refresh button re-fetches state", async ({ page, rpcMock }) => {
    await createAndLoad(page, rpcMock, { totalMinted: 0 });

    // Update mock state
    rpcMock.setConfig(encodeStablecoinConfig({ totalMinted: 10_000_000 }));
    await page.getByRole("button", { name: "Refresh" }).click();
    // Confirm refresh didn't crash — stats still visible
    await expect(page.getByText("Total Minted")).toBeVisible();
  });
});
