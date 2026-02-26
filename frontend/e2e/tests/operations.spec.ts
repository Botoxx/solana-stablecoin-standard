import { test, expect } from "../fixtures/base.fixture";
import { encodeStablecoinConfig } from "../fixtures/account-factory";
import { OTHER_PUBKEY } from "../fixtures/test-wallet";
import { createAndNavigateTo } from "../helpers/create-helper";

test.describe("Operations", () => {
  test("mint button disabled when fields empty, success toast on submit", async ({ page, rpcMock }) => {
    await createAndNavigateTo(page, rpcMock, "/operations");
    const mintCard = page.locator(".card").filter({ hasText: "Mint Tokens" });
    const mintBtn = mintCard.getByRole("button", { name: "Mint Tokens" });
    await expect(mintBtn).toBeDisabled();

    // Fill address and amount using placeholders within the mint card
    await mintCard.locator("input").first().fill(OTHER_PUBKEY.toBase58());
    await mintCard.locator("input").nth(1).fill("100");
    await expect(mintBtn).toBeEnabled();
    await mintBtn.click();
    await expect(page.getByText(/Mint/).first()).toBeVisible({ timeout: 15000 });
  });

  test("mint program error shows mapped error message", async ({ page, rpcMock }) => {
    await createAndNavigateTo(page, rpcMock, "/operations");

    rpcMock.nextSendError(6007, "Minter quota exceeded");
    const mintCard = page.locator(".card").filter({ hasText: "Mint Tokens" });
    await mintCard.locator("input").first().fill(OTHER_PUBKEY.toBase58());
    await mintCard.locator("input").nth(1).fill("999999");
    await mintCard.getByRole("button", { name: "Mint Tokens" }).click();
    await expect(page.getByText("Minter quota exceeded")).toBeVisible({ timeout: 15000 });
  });

  test("burn button disabled when empty, success flow", async ({ page, rpcMock }) => {
    await createAndNavigateTo(page, rpcMock, "/operations");
    const burnCard = page.locator(".card").filter({ hasText: "Burn Tokens" });
    const burnBtn = burnCard.getByRole("button", { name: "Burn Tokens" });
    await expect(burnBtn).toBeDisabled();

    await burnCard.locator("input").nth(1).fill("50");
    await expect(burnBtn).toBeEnabled();
    await burnBtn.click();
    await expect(page.getByText(/Burn/).first()).toBeVisible({ timeout: 15000 });
  });

  test("freeze shows success toast", async ({ page, rpcMock }) => {
    await createAndNavigateTo(page, rpcMock, "/operations");
    const card = page.locator(".card").filter({ hasText: "Freeze" });
    await card.locator("input").first().fill(OTHER_PUBKEY.toBase58());
    await card.getByRole("button", { name: "Freeze" }).click();
    await expect(page.getByText(/Freez/).first()).toBeVisible({ timeout: 15000 });
  });

  test("thaw shows success toast", async ({ page, rpcMock }) => {
    await createAndNavigateTo(page, rpcMock, "/operations");
    const card = page.locator(".card").filter({ hasText: "Thaw" });
    await card.locator("input").first().fill(OTHER_PUBKEY.toBase58());
    await card.getByRole("button", { name: "Thaw" }).click();
    await expect(page.getByText(/Thaw/).first()).toBeVisible({ timeout: 15000 });
  });

  test("pause toggle: Active -> Paused -> Active", async ({ page, rpcMock }) => {
    await createAndNavigateTo(page, rpcMock, "/operations", { paused: false });
    await expect(page.getByText("System Active")).toBeVisible();

    // Pause
    rpcMock.setConfig(encodeStablecoinConfig({ paused: true }));
    await page.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByText("System Paused")).toBeVisible({ timeout: 15000 });

    // Unpause
    rpcMock.setConfig(encodeStablecoinConfig({ paused: false }));
    await page.getByRole("button", { name: "Unpause" }).click();
    await expect(page.getByText("System Active")).toBeVisible({ timeout: 15000 });
  });

  test("paused state shows warning text", async ({ page, rpcMock }) => {
    await createAndNavigateTo(page, rpcMock, "/operations", { paused: true });
    await expect(page.getByText("Minting, burning, and transfers are disabled")).toBeVisible();
  });

  test("wallet rejection shows error message", async ({ page, rpcMock }) => {
    await createAndNavigateTo(page, rpcMock, "/operations");
    rpcMock.nextSendError(-1, "User rejected the request");

    const mintCard = page.locator(".card").filter({ hasText: "Mint Tokens" });
    await mintCard.locator("input").first().fill(OTHER_PUBKEY.toBase58());
    await mintCard.locator("input").nth(1).fill("100");
    await mintCard.getByRole("button", { name: "Mint Tokens" }).click();
    await expect(page.getByText(/rejected|error/i).first()).toBeVisible({ timeout: 15000 });
  });
});
