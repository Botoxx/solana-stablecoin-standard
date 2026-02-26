import { expect, Page } from "@playwright/test";
import { RpcMock } from "../fixtures/rpc-mock";
import { encodeStablecoinConfig, ConfigFields, SSS2_CONFIG } from "../fixtures/account-factory";

/**
 * Creates a stablecoin via the UI and waits for dashboard.
 * Shared across all test files that need a loaded stablecoin.
 */
export async function createAndLoad(
  page: Page,
  rpcMock: RpcMock,
  overrides: ConfigFields = {},
  sss2 = false,
) {
  const config = sss2 ? SSS2_CONFIG : encodeStablecoinConfig(overrides);
  rpcMock.setConfig(config);
  await page.goto("/create");
  if (sss2) await page.locator("button").filter({ hasText: "SSS-2" }).click();
  await page.getByPlaceholder("My USD").fill("TestCoin");
  await page.getByPlaceholder("MUSD").fill("TST");
  await page.getByRole("button", { name: "Create Stablecoin" }).click();
  await expect(page.getByText("Stablecoin created")).toBeVisible({ timeout: 15000 });
}

/** Map path to sidebar link text for client-side navigation (preserves React state) */
const PATH_TO_LINK: Record<string, string> = {
  "/": "Dashboard",
  "/create": "Create",
  "/load": "Load",
  "/operations": "Operations",
  "/roles": "Roles",
  "/compliance": "Compliance",
};

/** Creates stablecoin and navigates to a specific page via sidebar (client-side) */
export async function createAndNavigateTo(
  page: Page,
  rpcMock: RpcMock,
  path: string,
  overrides: ConfigFields = {},
  sss2 = false,
) {
  await createAndLoad(page, rpcMock, overrides, sss2);
  // Use client-side navigation via sidebar links to preserve React state
  const linkText = PATH_TO_LINK[path];
  if (linkText) {
    await page.locator(`a[href="${path}"]`).click();
  } else {
    await page.goto(path);
  }
  await page.waitForURL(`**${path}`);
}
