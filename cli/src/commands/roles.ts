import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { SolanaStablecoin, RoleType, ROLE_TYPE_NAMES, type RoleTypeValue } from "@stbr/sss-token";
import chalk from "chalk";
import { getProvider, getPayer, spinner, printSuccess, printError } from "../utils";

const VALID_ROLES = ["minter", "burner", "pauser", "blacklister", "seizer"];

function parseRole(name: string): RoleTypeValue {
  const entry = Object.entries(ROLE_TYPE_NAMES).find(([_, v]) => v === name.toLowerCase());
  if (!entry) {
    console.error(chalk.red(`Invalid role: ${name}. Valid: ${VALID_ROLES.join(", ")}`));
    process.exit(1);
  }
  return parseInt(entry[0]) as RoleTypeValue;
}

export function registerRoles(program: Command) {
  const roles = program
    .command("roles")
    .description("Manage role assignments");

  roles
    .command("add")
    .description("Assign a role to an address")
    .requiredOption("--config <address>", "Config PDA address")
    .requiredOption("--address <address>", "Address to assign role to")
    .requiredOption("--role <role>", `Role: ${VALID_ROLES.join(", ")}`)
    .option("--cluster <url>", "Cluster URL")
    .option("--keypair <path>", "Authority keypair path")
    .action(async (opts) => {
      const s = spinner("Assigning role...");
      try {
        const provider = getProvider(opts.cluster, opts.keypair);
        const role = parseRole(opts.role);
        s.start();
        const stable = await SolanaStablecoin.load(provider, new PublicKey(opts.config));
        const sig = await stable.addRole(getPayer(provider), new PublicKey(opts.address), role);
        s.stop();
        printSuccess(`Assigned ${opts.role} role to ${opts.address}`, sig);
      } catch (err: any) {
        s.stop();
        printError(err.message);
        process.exit(1);
      }
    });

  roles
    .command("remove")
    .description("Revoke a role from an address")
    .requiredOption("--config <address>", "Config PDA address")
    .requiredOption("--address <address>", "Address to revoke role from")
    .requiredOption("--role <role>", `Role: ${VALID_ROLES.join(", ")}`)
    .option("--cluster <url>", "Cluster URL")
    .option("--keypair <path>", "Authority keypair path")
    .action(async (opts) => {
      const s = spinner("Revoking role...");
      try {
        const provider = getProvider(opts.cluster, opts.keypair);
        const role = parseRole(opts.role);
        s.start();
        const stable = await SolanaStablecoin.load(provider, new PublicKey(opts.config));
        const sig = await stable.removeRole(getPayer(provider), new PublicKey(opts.address), role);
        s.stop();
        printSuccess(`Revoked ${opts.role} role from ${opts.address}`, sig);
      } catch (err: any) {
        s.stop();
        printError(err.message);
        process.exit(1);
      }
    });

  roles
    .command("check")
    .description("Check if an address has a role")
    .requiredOption("--config <address>", "Config PDA address")
    .requiredOption("--address <address>", "Address to check")
    .requiredOption("--role <role>", `Role: ${VALID_ROLES.join(", ")}`)
    .option("--cluster <url>", "Cluster URL")
    .option("--keypair <path>", "Keypair path")
    .action(async (opts) => {
      const s = spinner("Checking role...");
      try {
        const provider = getProvider(opts.cluster, opts.keypair);
        const role = parseRole(opts.role);
        s.start();
        const stable = await SolanaStablecoin.load(provider, new PublicKey(opts.config));
        const roleState = await stable.getRole(new PublicKey(opts.address), role);
        s.stop();

        if (roleState) {
          console.log(chalk.green(`\n  ${opts.address} has ${opts.role} role`));
          console.log(`  Assigned by: ${roleState.assignedBy.toBase58()}`);
        } else {
          console.log(chalk.yellow(`\n  ${opts.address} does NOT have ${opts.role} role`));
        }
        console.log();
      } catch (err: any) {
        s.stop();
        printError(err.message);
        process.exit(1);
      }
    });
}
