import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { SolanaStablecoin } from "@stbr/sss-token";
import { getProvider, getPayer, spinner, printSuccess, printError, parseTokenAmount } from "../utils";

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
        const provider = getProvider(opts.cluster, opts.keypair);
        s.start();
        const stable = await SolanaStablecoin.load(provider, new PublicKey(opts.config));
        const config = await stable.getConfig();
        const amount = parseTokenAmount(opts.amount, config.decimals);

        const sig = await stable.burn(
          getPayer(provider),
          new PublicKey(opts.from),
          amount
        );
        s.stop();
        printSuccess(`Burned ${opts.amount} tokens`, sig);
      } catch (err: any) {
        s.stop();
        printError(err.message);
        process.exit(1);
      }
    });
}
