import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { SolanaStablecoin } from "@stbr/sss-token";
import { getConnection, loadKeypair, spinner, printSuccess, printError, parseTokenAmount } from "../utils";

export function registerBurn(program: Command) {
  program
    .command("burn")
    .description("Burn tokens from a token account")
    .requiredOption("--config <address>", "Config PDA address")
    .requiredOption("--from <address>", "Token account to burn from")
    .requiredOption("--amount <amount>", "Amount in human-readable form")
    .option("--cluster <url>", "Cluster URL")
    .option("--keypair <path>", "Burner keypair path")
    .action(async (opts) => {
      const s = spinner("Burning tokens...");
      try {
        const connection = getConnection(opts.cluster);
        const authority = loadKeypair(opts.keypair);
        s.start();
        const stable = await SolanaStablecoin.load(connection, new PublicKey(opts.config), authority);
        const config = await stable.getConfig();
        const amount = parseTokenAmount(opts.amount, config.decimals);

        const sig = await stable.burn({
          amount,
          tokenAccount: new PublicKey(opts.from),
        });
        s.stop();
        printSuccess(`Burned ${opts.amount} tokens`, sig);
      } catch (err: any) {
        s.stop();
        printError(err.message);
        process.exit(1);
      }
    });
}
