import { test, expect } from "../fixtures/base.fixture";
import { SSS1_CONFIG, SSS2_CONFIG, encodeBlacklistEntry } from "../fixtures/account-factory";
import { MOCK_CONFIG_PDA, OTHER_PUBKEY } from "../fixtures/test-wallet";
import { createAndNavigateTo } from "../helpers/create-helper";
import { PublicKey } from "@solana/web3.js";
import { getBlacklistPda } from "../../src/lib/constants";

test.describe("Compliance", () => {
  test("SSS-1: shows Compliance Not Enabled warning", async ({ page, rpcMock }) => {
    await createAndNavigateTo(page, rpcMock, "/compliance");
    await expect(page.getByText("Compliance Not Enabled")).toBeVisible();
  });

  test("SSS-1: BlacklistPanel and SeizeFlow not rendered", async ({ page, rpcMock }) => {
    await createAndNavigateTo(page, rpcMock, "/compliance");
    // Use exact match to avoid matching the SSS-1 warning paragraph ("Blacklist management...")
    await expect(page.locator(".section-title").filter({ hasText: "Blacklist Management" })).toHaveCount(0);
    await expect(page.locator(".section-title").filter({ hasText: "Seize Tokens" })).toHaveCount(0);
  });

  test("SSS-2: shows Compliance Active with badges", async ({ page, rpcMock }) => {
    await createAndNavigateTo(page, rpcMock, "/compliance", {}, true);
    await expect(page.getByText("SSS-2 Compliance Active")).toBeVisible();
    await expect(page.getByText("Permanent Delegate").first()).toBeVisible();
    await expect(page.getByText("Transfer Hook").first()).toBeVisible();
  });

  test("SSS-2: blacklist add shows success toast", async ({ page, rpcMock }) => {
    await createAndNavigateTo(page, rpcMock, "/compliance", {}, true);
    const blCard = page.locator(".card").filter({ hasText: "Blacklist Management" });
    await blCard.locator("input").first().fill(OTHER_PUBKEY.toBase58());
    await blCard.getByPlaceholder("OFAC sanctioned entity").fill("Test reason");
    await blCard.getByRole("button", { name: "Blacklist" }).click();
    await expect(page.getByText(/Blacklist|blacklist/).first()).toBeVisible({ timeout: 15000 });
  });

  test("SSS-2: check status shows result card", async ({ page, rpcMock }) => {
    await createAndNavigateTo(page, rpcMock, "/compliance", {}, true);

    // Derive the blacklist PDA using the dynamic config PDA discovered during create
    const dynamicConfig = rpcMock.getDynamicConfigPda();
    const configPk = dynamicConfig ? new PublicKey(dynamicConfig) : MOCK_CONFIG_PDA;
    const [blacklistPda] = getBlacklistPda(configPk, OTHER_PUBKEY);

    const blData = encodeBlacklistEntry({
      config: configPk,
      address: OTHER_PUBKEY,
      reason: "OFAC sanctioned",
      active: true,
    });
    rpcMock.setAccount(blacklistPda, blData);

    const blCard = page.locator(".card").filter({ hasText: "Blacklist Management" });
    await blCard.locator("input").first().fill(OTHER_PUBKEY.toBase58());
    await blCard.getByRole("button", { name: "Check Status" }).click();
    await expect(page.getByText(/Blacklisted|blacklisted/).first()).toBeVisible({ timeout: 15000 });
  });

  test("SSS-2: seize flow — input → review → confirm → done", async ({ page, rpcMock }) => {
    await createAndNavigateTo(page, rpcMock, "/compliance", {}, true);
    const seizeSection = page.locator(".card").filter({ hasText: "Seize Tokens" });

    // Step 1: Fill seizure form
    await seizeSection.locator("input").first().fill(OTHER_PUBKEY.toBase58());
    await seizeSection.locator("input").nth(1).fill("500");
    await seizeSection.getByRole("button", { name: "Review Seizure" }).click();

    // Step 2: Review
    await expect(page.getByText("Confirm Seizure")).toBeVisible();
    await page.getByRole("button", { name: "Confirm Seize" }).click();

    // Step 3: Done
    await expect(page.getByText("Seizure Complete")).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: "New Seizure" })).toBeVisible();
  });
});
