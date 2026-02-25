import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { SolanaStablecoin } from "@stbr/sss-token";
import chalk from "chalk";
import { getConnection, loadKeypair, spinner, printError, formatTokenAmount } from "../utils";

export function registerStatus(program: Command) {
  program
    .command("status")
    .description("Show stablecoin configuration and supply info")
    .requiredOption("--config <address>", "Config PDA address")
    .option("--cluster <url>", "Cluster URL")
    .option("--keypair <path>", "Keypair path")
    .action(async (opts) => {
      const s = spinner("Fetching status...");
      try {
        const connection = getConnection(opts.cluster);
        const authority = loadKeypair(opts.keypair);
        s.start();
        const stable = await SolanaStablecoin.load(connection, new PublicKey(opts.config), authority);
        const config = await stable.getConfig();
        s.stop();

        const supply = config.totalMinted.sub(config.totalBurned);

        console.log(chalk.bold("\n  Stablecoin Status\n"));
        console.log(`  Mint:              ${stable.mintAddress.toBase58()}`);
        console.log(`  Config:            ${stable.configPda.toBase58()}`);
        console.log(`  Authority:         ${config.authority.toBase58()}`);
        console.log(`  Treasury:          ${config.treasury.toBase58()}`);
        console.log(`  Decimals:          ${config.decimals}`);
        console.log(`  Paused:            ${config.paused ? chalk.red("YES") : chalk.green("NO")}`);
        console.log(`  Total Minted:      ${formatTokenAmount(config.totalMinted.toString(), config.decimals)}`);
        console.log(`  Total Burned:      ${formatTokenAmount(config.totalBurned.toString(), config.decimals)}`);
        console.log(`  Current Supply:    ${formatTokenAmount(supply.toString(), config.decimals)}`);
        console.log(`\n  Extensions:`);
        console.log(`    Permanent Delegate: ${config.enablePermanentDelegate ? chalk.yellow("ENABLED") : "disabled"}`);
        console.log(`    Transfer Hook:      ${config.enableTransferHook ? chalk.yellow("ENABLED") : "disabled"}`);
        console.log(`    Default Frozen:     ${config.defaultAccountFrozen ? chalk.yellow("ENABLED") : "disabled"}`);
        if (config.pendingAuthority) {
          console.log(`\n  ${chalk.yellow("Pending authority transfer:")} ${config.pendingAuthority.toBase58()}`);
        }
        console.log();
      } catch (err: any) {
        s.stop();
        printError(err.message);
        process.exit(1);
      }
    });
}
