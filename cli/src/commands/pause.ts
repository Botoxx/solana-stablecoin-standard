import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { SolanaStablecoin } from "@stbr/sss-token";
import { getProvider, getPayer, spinner, printSuccess, printError } from "../utils";

export function registerPause(program: Command) {
  program
    .command("pause")
    .description("Pause the stablecoin system")
    .requiredOption("--config <address>", "Config PDA address")
    .option("--cluster <url>", "Cluster URL")
    .option("--keypair <path>", "Pauser keypair path")
    .action(async (opts) => {
      const s = spinner("Pausing...");
      try {
        const provider = getProvider(opts.cluster, opts.keypair);
        s.start();
        const stable = await SolanaStablecoin.load(provider, new PublicKey(opts.config));
        const sig = await stable.pause(getPayer(provider));
        s.stop();
        printSuccess("System paused", sig);
      } catch (err: any) {
        s.stop();
        printError(err.message);
        process.exit(1);
      }
    });
}

export function registerUnpause(program: Command) {
  program
    .command("unpause")
    .description("Unpause the stablecoin system")
    .requiredOption("--config <address>", "Config PDA address")
    .option("--cluster <url>", "Cluster URL")
    .option("--keypair <path>", "Pauser keypair path")
    .action(async (opts) => {
      const s = spinner("Unpausing...");
      try {
        const provider = getProvider(opts.cluster, opts.keypair);
        s.start();
        const stable = await SolanaStablecoin.load(provider, new PublicKey(opts.config));
        const sig = await stable.unpause(getPayer(provider));
        s.stop();
        printSuccess("System unpaused", sig);
      } catch (err: any) {
        s.stop();
        printError(err.message);
        process.exit(1);
      }
    });
}
