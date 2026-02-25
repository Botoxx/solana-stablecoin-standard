import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { SolanaStablecoin } from "@stbr/sss-token";
import chalk from "chalk";
import { getConnection, loadKeypair, spinner, printSuccess, printError, parseTokenAmount, formatTokenAmount } from "../utils";

export function registerMinters(program: Command) {
  const minters = program
    .command("minters")
    .description("Manage minter configurations");

  minters
    .command("add")
    .description("Add a minter with quota")
    .requiredOption("--config <address>", "Config PDA address")
    .requiredOption("--address <address>", "Minter address")
    .requiredOption("--quota <amount>", "Minting quota in human-readable form")
    .option("--cluster <url>", "Cluster URL")
    .option("--keypair <path>", "Authority keypair path")
    .action(async (opts) => {
      const s = spinner("Adding minter...");
      try {
        const connection = getConnection(opts.cluster);
        const authority = loadKeypair(opts.keypair);
        s.start();
        const stable = await SolanaStablecoin.load(connection, new PublicKey(opts.config), authority);
        const config = await stable.getConfig();
        const quota = parseTokenAmount(opts.quota, config.decimals);
        const sig = await stable.addMinter(new PublicKey(opts.address), quota);
        s.stop();
        printSuccess(`Added minter ${opts.address} with quota ${opts.quota}`, sig);
      } catch (err: any) {
        s.stop();
        printError(err.message);
        process.exit(1);
      }
    });

  minters
    .command("remove")
    .description("Remove a minter")
    .requiredOption("--config <address>", "Config PDA address")
    .requiredOption("--address <address>", "Minter address")
    .option("--cluster <url>", "Cluster URL")
    .option("--keypair <path>", "Authority keypair path")
    .action(async (opts) => {
      const s = spinner("Removing minter...");
      try {
        const connection = getConnection(opts.cluster);
        const authority = loadKeypair(opts.keypair);
        s.start();
        const stable = await SolanaStablecoin.load(connection, new PublicKey(opts.config), authority);
        const sig = await stable.removeMinter(new PublicKey(opts.address));
        s.stop();
        printSuccess(`Removed minter ${opts.address}`, sig);
      } catch (err: any) {
        s.stop();
        printError(err.message);
        process.exit(1);
      }
    });

  minters
    .command("list")
    .description("Show info for a specific minter")
    .requiredOption("--config <address>", "Config PDA address")
    .requiredOption("--address <address>", "Minter address to query")
    .option("--cluster <url>", "Cluster URL")
    .option("--keypair <path>", "Keypair path")
    .action(async (opts) => {
      const s = spinner("Fetching minter info...");
      try {
        const connection = getConnection(opts.cluster);
        const authority = loadKeypair(opts.keypair);
        s.start();
        const stable = await SolanaStablecoin.load(connection, new PublicKey(opts.config), authority);
        const config = await stable.getConfig();
        const minter = await stable.getMinter(new PublicKey(opts.address));
        s.stop();

        if (minter) {
          console.log(chalk.bold(`\n  Minter: ${opts.address}`));
          console.log(`  Quota Total:     ${formatTokenAmount(minter.quotaTotal.toString(), config.decimals)}`);
          console.log(`  Quota Remaining: ${formatTokenAmount(minter.quotaRemaining.toString(), config.decimals)}`);
          console.log(`  Used:            ${formatTokenAmount(minter.quotaTotal.sub(minter.quotaRemaining).toString(), config.decimals)}`);
        } else {
          console.log(chalk.yellow(`\n  ${opts.address} is not a minter`));
        }
        console.log();
      } catch (err: any) {
        s.stop();
        printError(err.message);
        process.exit(1);
      }
    });
}
