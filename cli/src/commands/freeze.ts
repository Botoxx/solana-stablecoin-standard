import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { SolanaStablecoin } from "@stbr/sss-token";
import { getConnection, loadKeypair, spinner, printSuccess, printError } from "../utils";

export function registerFreeze(program: Command) {
  program
    .command("freeze")
    .description("Freeze a token account")
    .requiredOption("--config <address>", "Config PDA address")
    .requiredOption("--account <address>", "Token account to freeze")
    .option("--cluster <url>", "Cluster URL")
    .option("--keypair <path>", "Authority keypair path")
    .action(async (opts) => {
      const s = spinner("Freezing account...");
      try {
        const connection = getConnection(opts.cluster);
        const authority = loadKeypair(opts.keypair);
        s.start();
        const stable = await SolanaStablecoin.load(connection, new PublicKey(opts.config), authority);
        const sig = await stable.freezeAccount(new PublicKey(opts.account));
        s.stop();
        printSuccess("Account frozen", sig);
      } catch (err: any) {
        s.stop();
        printError(err.message);
        process.exit(1);
      }
    });
}

export function registerThaw(program: Command) {
  program
    .command("thaw")
    .description("Thaw a frozen token account")
    .requiredOption("--config <address>", "Config PDA address")
    .requiredOption("--account <address>", "Token account to thaw")
    .option("--cluster <url>", "Cluster URL")
    .option("--keypair <path>", "Authority keypair path")
    .action(async (opts) => {
      const s = spinner("Thawing account...");
      try {
        const connection = getConnection(opts.cluster);
        const authority = loadKeypair(opts.keypair);
        s.start();
        const stable = await SolanaStablecoin.load(connection, new PublicKey(opts.config), authority);
        const sig = await stable.thawAccount(new PublicKey(opts.account));
        s.stop();
        printSuccess("Account thawed", sig);
      } catch (err: any) {
        s.stop();
        printError(err.message);
        process.exit(1);
      }
    });
}
