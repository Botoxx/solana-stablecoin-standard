import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { SolanaStablecoin, Presets, type Preset } from "@stbr/sss-token";
import { getConnection, loadKeypair, spinner, printSuccess, printError, parseTomlConfig } from "../utils";

export function registerInit(program: Command) {
  program
    .command("init")
    .description("Initialize a new stablecoin")
    .option("--name <name>", "Token name")
    .option("--symbol <symbol>", "Token symbol")
    .option("--uri <uri>", "Metadata URI", "")
    .option("--decimals <n>", "Decimal places", "6")
    .option("--preset <preset>", "Preset: sss-1 or sss-2")
    .option("--custom <path>", "Custom config file (TOML)")
    .option("--permanent-delegate", "Enable permanent delegate (SSS-2)")
    .option("--transfer-hook", "Enable transfer hook (SSS-2)")
    .option("--treasury <address>", "Treasury address")
    .option("--cluster <url>", "Cluster URL")
    .option("--keypair <path>", "Authority keypair path")
    .action(async (opts) => {
      const s = spinner("Initializing stablecoin...");
      try {
        // Merge TOML config (if provided) with CLI flags (flags take precedence)
        const toml = opts.custom ? parseTomlConfig(opts.custom) : {};
        const name = opts.name || toml.name;
        const symbol = opts.symbol || toml.symbol;
        if (!name || !symbol) {
          printError("--name and --symbol are required (via flags or --custom config file)");
          process.exit(1);
        }

        const connection = getConnection(opts.cluster || toml.cluster);
        const authority = loadKeypair(opts.keypair || toml.keypair);
        const preset = (opts.preset || toml.preset) as Preset | undefined;
        const treasury = opts.treasury || toml.treasury;
        const uri = opts.uri !== "" ? opts.uri : (toml.uri || "");
        const decimals = opts.decimals !== "6" ? parseInt(opts.decimals) : parseInt(toml.decimals || "6");

        const extensions = preset ? undefined : {
          permanentDelegate: opts.permanentDelegate || toml.permanent_delegate === "true",
          transferHook: opts.transferHook || toml.transfer_hook === "true",
          defaultAccountFrozen: toml.default_account_frozen === "true",
        };

        s.start();
        const stable = await SolanaStablecoin.create(connection, {
          name,
          symbol,
          uri,
          decimals,
          authority,
          treasury: treasury ? new PublicKey(treasury) : undefined,
          preset,
          extensions,
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
