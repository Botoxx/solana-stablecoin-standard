import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { SolanaStablecoin } from "@stbr/sss-token";
import { getConnection, loadKeypair, spinner, printError, formatTokenAmount } from "../utils";

export function registerSupply(program: Command) {
  program
    .command("supply")
    .description("Show current token supply")
    .requiredOption("--config <address>", "Config PDA address")
    .option("--cluster <url>", "Cluster URL")
    .option("--keypair <path>", "Keypair path")
    .action(async (opts) => {
      const s = spinner("Fetching supply...");
      try {
        const connection = getConnection(opts.cluster);
        const authority = loadKeypair(opts.keypair);
        s.start();
        const stable = await SolanaStablecoin.load(connection, new PublicKey(opts.config), authority);
        const config = await stable.getConfig();
        const supply = config.totalMinted.sub(config.totalBurned);
        s.stop();

        console.log(`\n  Supply: ${formatTokenAmount(supply.toString(), config.decimals)}\n`);
      } catch (err: any) {
        s.stop();
        printError(err.message);
        process.exit(1);
      }
    });
}
