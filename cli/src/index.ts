#!/usr/bin/env node

import { Command } from "commander";
import { registerInit } from "./commands/init";
import { registerMint } from "./commands/mint";
import { registerBurn } from "./commands/burn";
import { registerFreeze, registerThaw } from "./commands/freeze";
import { registerPause, registerUnpause } from "./commands/pause";
import { registerStatus } from "./commands/status";
import { registerBlacklist } from "./commands/blacklist";
import { registerSeize } from "./commands/seize";
import { registerRoles } from "./commands/roles";
import { registerMinters } from "./commands/minters";

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
registerBlacklist(program);
registerSeize(program);
registerRoles(program);
registerMinters(program);

program.parse();
