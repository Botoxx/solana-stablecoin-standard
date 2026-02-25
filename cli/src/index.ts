#!/usr/bin/env node

import { Command } from "commander";
import { registerInit } from "./commands/init";
import { registerMint } from "./commands/mint";
import { registerBurn } from "./commands/burn";
import { registerFreeze, registerThaw } from "./commands/freeze";
import { registerPause, registerUnpause } from "./commands/pause";
import { registerStatus } from "./commands/status";
import { registerSupply } from "./commands/supply";
import { registerBlacklist } from "./commands/blacklist";
import { registerSeize } from "./commands/seize";
import { registerRoles } from "./commands/roles";
import { registerMinters } from "./commands/minters";
import { registerHolders } from "./commands/holders";
import { registerAuditLog } from "./commands/audit-log";

const program = new Command();

program
  .name("sss-token")
  .description("Solana Stablecoin Standard CLI")
  .version("0.1.0");

registerInit(program);
registerMint(program);
registerBurn(program);
registerFreeze(program);
registerThaw(program);
registerPause(program);
registerUnpause(program);
registerStatus(program);
registerSupply(program);
registerBlacklist(program);
registerSeize(program);
registerRoles(program);
registerMinters(program);
registerHolders(program);
registerAuditLog(program);

program.parse();
