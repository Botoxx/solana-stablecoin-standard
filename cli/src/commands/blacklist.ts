import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { SolanaStablecoin } from "@stbr/sss-token";
import chalk from "chalk";
import { getProvider, getPayer, spinner, printSuccess, printError } from "../utils";

export function registerBlacklist(program: Command) {
  const bl = program
    .command("blacklist")
    .description("Manage blacklist entries (SSS-2)");

  bl.command("add")
    .description("Add address to blacklist")
    .requiredOption("--config <address>", "Config PDA address")
    .requiredOption("--address <address>", "Address to blacklist")
    .requiredOption("--reason <reason>", "Reason for blacklisting")
    .option("--cluster <url>", "Cluster URL")
    .option("--keypair <path>", "Blacklister keypair path")
    .action(async (opts) => {
      const s = spinner("Adding to blacklist...");
      try {
        const provider = getProvider(opts.cluster, opts.keypair);
        s.start();
        const stable = await SolanaStablecoin.load(provider, new PublicKey(opts.config));
        const sig = await stable.compliance.addToBlacklist(
          getPayer(provider),
          new PublicKey(opts.address),
          opts.reason
        );
        s.stop();
        printSuccess(`Blacklisted ${opts.address}`, sig);
      } catch (err: any) {
        s.stop();
        printError(err.message);
        process.exit(1);
      }
    });

  bl.command("remove")
    .description("Remove address from blacklist")
    .requiredOption("--config <address>", "Config PDA address")
    .requiredOption("--address <address>", "Address to remove")
    .option("--cluster <url>", "Cluster URL")
    .option("--keypair <path>", "Blacklister keypair path")
    .action(async (opts) => {
      const s = spinner("Removing from blacklist...");
      try {
        const provider = getProvider(opts.cluster, opts.keypair);
        s.start();
        const stable = await SolanaStablecoin.load(provider, new PublicKey(opts.config));
        const sig = await stable.compliance.removeFromBlacklist(
          getPayer(provider),
          new PublicKey(opts.address)
        );
        s.stop();
        printSuccess(`Removed ${opts.address} from blacklist`, sig);
      } catch (err: any) {
        s.stop();
        printError(err.message);
        process.exit(1);
      }
    });

  bl.command("check")
    .description("Check if an address is blacklisted")
    .requiredOption("--config <address>", "Config PDA address")
    .requiredOption("--address <address>", "Address to check")
    .option("--cluster <url>", "Cluster URL")
    .option("--keypair <path>", "Keypair path")
    .action(async (opts) => {
      const s = spinner("Checking blacklist...");
      try {
        const provider = getProvider(opts.cluster, opts.keypair);
        s.start();
        const stable = await SolanaStablecoin.load(provider, new PublicKey(opts.config));
        const entry = await stable.compliance.getBlacklistEntry(new PublicKey(opts.address));
        s.stop();

        if (entry && entry.active) {
          console.log(chalk.red(`\n  BLACKLISTED: ${opts.address}`));
          console.log(`  Reason: ${entry.reason}`);
          console.log(`  By:     ${entry.blacklistedBy.toBase58()}`);
        } else {
          console.log(chalk.green(`\n  NOT BLACKLISTED: ${opts.address}`));
        }
        console.log();
      } catch (err: any) {
        s.stop();
        printError(err.message);
        process.exit(1);
      }
    });
}
