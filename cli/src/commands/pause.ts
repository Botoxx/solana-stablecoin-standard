import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { SolanaStablecoin } from "@stbr/sss-token";
import { getConnection, loadKeypair, spinner, printSuccess, printError } from "../utils";

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
        const connection = getConnection(opts.cluster);
        const authority = loadKeypair(opts.keypair);
        s.start();
        const stable = await SolanaStablecoin.load(connection, new PublicKey(opts.config), authority);
        const sig = await stable.pause();
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
        const connection = getConnection(opts.cluster);
        const authority = loadKeypair(opts.keypair);
        s.start();
        const stable = await SolanaStablecoin.load(connection, new PublicKey(opts.config), authority);
        const sig = await stable.unpause();
        s.stop();
        printSuccess("System unpaused", sig);
      } catch (err: any) {
        s.stop();
        printError(err.message);
        process.exit(1);
      }
    });
}
