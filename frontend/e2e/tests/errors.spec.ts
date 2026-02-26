import { test, expect } from "../fixtures/base.fixture";
import { OTHER_PUBKEY } from "../fixtures/test-wallet";
import { createAndNavigateTo } from "../helpers/create-helper";

test.describe("Error handling", () => {
  test("invalid base58 address shows validation error", async ({ page, rpcMock }) => {
    await createAndNavigateTo(page, rpcMock, "/operations");
    const mintCard = page.locator(".card").filter({ hasText: "Mint Tokens" });
    await mintCard.locator("input").first().fill("not-valid-base58!!!");
    // Click elsewhere to trigger validation
    await mintCard.locator("input").nth(1).click();
    await expect(page.getByText("Invalid address").first()).toBeVisible();
  });

  test("program error codes mapped to human messages", async ({ page, rpcMock }) => {
    await createAndNavigateTo(page, rpcMock, "/operations");
    rpcMock.nextSendError(6001, "System is paused");

    const mintCard = page.locator(".card").filter({ hasText: "Mint Tokens" });
    await mintCard.locator("input").first().fill(OTHER_PUBKEY.toBase58());
    await mintCard.locator("input").nth(1).fill("100");
    await mintCard.getByRole("button", { name: "Mint Tokens" }).click();
    await expect(page.getByText("System is paused")).toBeVisible({ timeout: 15000 });
  });

  test("blockhash expired shows retry message", async ({ page, rpcMock }) => {
    await createAndNavigateTo(page, rpcMock, "/operations");
    rpcMock.nextSendError(-32003, "Blockhash not found");

    const mintCard = page.locator(".card").filter({ hasText: "Mint Tokens" });
    await mintCard.locator("input").first().fill(OTHER_PUBKEY.toBase58());
    await mintCard.locator("input").nth(1).fill("100");
    await mintCard.getByRole("button", { name: "Mint Tokens" }).click();
    await expect(page.getByText(/expired|try again/i).first()).toBeVisible({ timeout: 15000 });
  });

  test("long error messages are truncated", async ({ page, rpcMock }) => {
    await createAndNavigateTo(page, rpcMock, "/operations");
    rpcMock.nextSendError(-1, "A".repeat(200));

    const mintCard = page.locator(".card").filter({ hasText: "Mint Tokens" });
    await mintCard.locator("input").first().fill(OTHER_PUBKEY.toBase58());
    await mintCard.locator("input").nth(1).fill("100");
    await mintCard.getByRole("button", { name: "Mint Tokens" }).click();

    const toast = page.locator(".fixed.bottom-4 p").first();
    await expect(toast).toBeVisible({ timeout: 15000 });
    const text = await toast.textContent();
    expect(text!.length).toBeLessThanOrEqual(130);
  });
});
