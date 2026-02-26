import { test as base } from "@playwright/test";
import { RpcMock } from "./rpc-mock";

export const test = base.extend<{ rpcMock: RpcMock }>({
  // auto: true ensures RPC interception + localStorage runs for ALL tests,
  // even those that don't explicitly destructure rpcMock
  rpcMock: [async ({ page }, use) => {
    const mock = new RpcMock();
    await mock.install(page);

    // Auto-connect TestWalletAdapter
    await page.addInitScript(() => {
      localStorage.setItem("walletName", JSON.stringify("E2E Test Wallet"));
      localStorage.setItem("sss-network", "devnet");
    });

    await use(mock);
    mock.clear();
  }, { auto: true }],
});

export { expect } from "@playwright/test";
