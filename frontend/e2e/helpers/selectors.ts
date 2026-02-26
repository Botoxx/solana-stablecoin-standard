/**
 * Centralized selectors — no data-testid in the app, so we use text/role/label selectors.
 * Each returns a string suitable for page.getByText / page.getByRole / page.locator.
 */

export const nav = {
  dashboard: 'a[href="/"]',
  create: 'a[href="/create"]',
  load: 'a[href="/load"]',
  operations: 'a[href="/operations"]',
  roles: 'a[href="/roles"]',
  compliance: 'a[href="/compliance"]',
};

export const dashboard = {
  heading: "Dashboard",
  refreshBtn: "Refresh",
  createNewBtn: "Create new",
  loadExistingBtn: "Load existing",
  totalSupply: "Total Supply",
  totalMinted: "Total Minted",
  totalBurned: "Total Burned",
  decimals: "Decimals",
  pausedPill: "PAUSED",
  extensionsTitle: "Extensions",
  addressesTitle: "Addresses",
};

export const create = {
  heading: "Create Stablecoin",
  nameInput: "Name",
  symbolInput: "Symbol",
  uriInput: "URI (optional)",
  decimalsInput: "Decimals",
  treasuryInput: "Treasury (defaults to your wallet)",
  submitBtn: "Create Stablecoin",
  sss1Card: "SSS-1",
  sss2Card: "SSS-2",
  minimalTag: "Minimal",
  compliantTag: "Compliant",
};

export const load = {
  heading: "Load Stablecoin",
  configInput: "Config PDA Address",
  submitBtn: "Load",
};

export const ops = {
  heading: "Operations",
  mintBtn: "Mint Tokens",
  burnBtn: "Burn Tokens",
  freezeBtn: "Freeze",
  thawBtn: "Thaw",
  pauseBtn: "Pause",
  unpauseBtn: "Unpause",
  systemActive: "System Active",
  systemPaused: "System Paused",
};

export const roles = {
  heading: "Role & Minter Management",
  assignBtn: "Assign",
  revokeBtn: "Revoke",
  addMinterBtn: "Add Minter",
  updateQuotaBtn: "Update Quota",
  removeBtn: "Remove",
};

export const compliance = {
  heading: "Compliance",
  blacklistBtn: "Blacklist",
  removeBtn: "Remove",
  checkStatusBtn: "Check Status",
  complianceNotEnabled: "Compliance Not Enabled",
  complianceActive: "SSS-2 Compliance Active",
  reviewSeizureBtn: "Review Seizure",
  confirmSeizeBtn: "Confirm Seize",
  seizureComplete: "Seizure Complete",
  newSeizureBtn: "New Seizure",
};

export const emptyState = "No stablecoin loaded";
export const walletRejected = "Transaction rejected by wallet";
