import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { SolanaStablecoin } from "@stbr/sss-token";
import { getConnection, loadKeypair, spinner, printSuccess, printError, parseTokenAmount } from "../utils";

export function registerMint(program: Command) {
  program
    .command("mint")
    .description("Mint tokens to a recipient")
    .requiredOption("--config <address>", "Config PDA address")
    .requiredOption("--to <address>", "Recipient token account")
    .requiredOption("--amount <amount>", "Amount in human-readable form (e.g. 100.5)")
    .option("--cluster <url>", "Cluster URL")
    .option("--keypair <path>", "Minter keypair path")
    .action(async (opts) => {
      const s = spinner("Minting tokens...");
      try {
        const connection = getConnection(opts.cluster);
        const authority = loadKeypair(opts.keypair);
        s.start();
        const stable = await SolanaStablecoin.load(connection, new PublicKey(opts.config), authority);
        const config = await stable.getConfig();
        const amount = parseTokenAmount(opts.amount, config.decimals);

        const sig = await stable.mint({
          recipient: new PublicKey(opts.to),
          amount,
        });
        s.stop();
        printSuccess(`Minted ${opts.amount} tokens`, sig);
      } catch (err: any) {
        s.stop();
        printError(err.message);
        process.exit(1);
      }
    });
}
