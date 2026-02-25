import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { SolanaStablecoin, Presets, type Preset } from "@stbr/sss-token";
import { getConnection, loadKeypair, spinner, printSuccess, printError } from "../utils";

export function registerInit(program: Command) {
  program
    .command("init")
    .description("Initialize a new stablecoin")
    .requiredOption("--name <name>", "Token name")
    .requiredOption("--symbol <symbol>", "Token symbol")
    .option("--uri <uri>", "Metadata URI", "")
    .option("--decimals <n>", "Decimal places", "6")
    .option("--preset <preset>", "Preset: sss-1 or sss-2")
    .option("--permanent-delegate", "Enable permanent delegate (SSS-2)")
    .option("--transfer-hook", "Enable transfer hook (SSS-2)")
    .option("--treasury <address>", "Treasury address")
    .option("--cluster <url>", "Cluster URL")
    .option("--keypair <path>", "Authority keypair path")
    .action(async (opts) => {
      const s = spinner("Initializing stablecoin...");
      try {
        const connection = getConnection(opts.cluster);
        const authority = loadKeypair(opts.keypair);

        s.start();
        const stable = await SolanaStablecoin.create(connection, {
          name: opts.name,
          symbol: opts.symbol,
          uri: opts.uri,
          decimals: parseInt(opts.decimals),
          authority,
          treasury: opts.treasury ? new PublicKey(opts.treasury) : undefined,
          preset: opts.preset as Preset | undefined,
          extensions: opts.preset ? undefined : {
            permanentDelegate: !!opts.permanentDelegate,
            transferHook: !!opts.transferHook,
          },
        });

        s.stop();
        printSuccess(`Stablecoin initialized`);
        console.log(`  Mint:   ${stable.mintAddress.toBase58()}`);
        console.log(`  Config: ${stable.configPda.toBase58()}`);
      } catch (err: any) {
        s.stop();
        printError(err.message);
        process.exit(1);
      }
    });
}
