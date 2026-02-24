import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { SolanaStablecoin, Preset } from "@stbr/sss-token";
import { getProvider, getPayer, spinner, printSuccess, printError } from "../utils";

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
        const provider = getProvider(opts.cluster, opts.keypair);
        const authority = getPayer(provider);

        let stable: SolanaStablecoin;
        if (opts.preset) {
          s.start();
          stable = await SolanaStablecoin.fromPreset(
            provider,
            authority,
            opts.preset as Preset,
            {
              name: opts.name,
              symbol: opts.symbol,
              uri: opts.uri,
              decimals: parseInt(opts.decimals),
              treasury: opts.treasury ? new PublicKey(opts.treasury) : undefined,
            }
          );
        } else {
          s.start();
          stable = await SolanaStablecoin.create(provider, authority, {
            name: opts.name,
            symbol: opts.symbol,
            uri: opts.uri,
            decimals: parseInt(opts.decimals),
            enablePermanentDelegate: !!opts.permanentDelegate,
            enableTransferHook: !!opts.transferHook,
            treasury: opts.treasury ? new PublicKey(opts.treasury) : undefined,
          });
        }

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
