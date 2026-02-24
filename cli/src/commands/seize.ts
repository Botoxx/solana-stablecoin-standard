import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { SolanaStablecoin } from "@stbr/sss-token";
import { getProvider, getPayer, spinner, printSuccess, printError, parseTokenAmount } from "../utils";

export function registerSeize(program: Command) {
  program
    .command("seize")
    .description("Seize tokens from a frozen account to treasury (SSS-2)")
    .requiredOption("--config <address>", "Config PDA address")
    .requiredOption("--from <address>", "Source token account (must be frozen)")
    .requiredOption("--to <address>", "Treasury token account")
    .requiredOption("--amount <amount>", "Amount in human-readable form")
    .option("--cluster <url>", "Cluster URL")
    .option("--keypair <path>", "Seizer keypair path")
    .action(async (opts) => {
      const s = spinner("Seizing tokens...");
      try {
        const provider = getProvider(opts.cluster, opts.keypair);
        s.start();
        const stable = await SolanaStablecoin.load(provider, new PublicKey(opts.config));
        const config = await stable.getConfig();
        const amount = parseTokenAmount(opts.amount, config.decimals);

        const sig = await stable.compliance.seize(
          getPayer(provider),
          new PublicKey(opts.from),
          new PublicKey(opts.to),
          amount
        );
        s.stop();
        printSuccess(`Seized ${opts.amount} tokens`, sig);
      } catch (err: any) {
        s.stop();
        printError(err.message);
        process.exit(1);
      }
    });
}
