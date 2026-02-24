import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { SolanaStablecoin } from "@stbr/sss-token";
import { getProvider, getPayer, spinner, printSuccess, printError, parseTokenAmount } from "../utils";

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
        const provider = getProvider(opts.cluster, opts.keypair);
        s.start();
        const stable = await SolanaStablecoin.load(provider, new PublicKey(opts.config));
        const config = await stable.getConfig();
        const amount = parseTokenAmount(opts.amount, config.decimals);

        const sig = await stable.mintTokens(
          getPayer(provider),
          new PublicKey(opts.to),
          amount
        );
        s.stop();
        printSuccess(`Minted ${opts.amount} tokens`, sig);
      } catch (err: any) {
        s.stop();
        printError(err.message);
        process.exit(1);
      }
    });
}
