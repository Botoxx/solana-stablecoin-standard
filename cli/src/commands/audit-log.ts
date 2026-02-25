import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { SolanaStablecoin, SSS_TOKEN_PROGRAM_ID } from "@stbr/sss-token";
import chalk from "chalk";
import { getConnection, loadKeypair, spinner, printError } from "../utils";

export function registerAuditLog(program: Command) {
  program
    .command("audit-log")
    .description("Show recent on-chain events for the stablecoin")
    .requiredOption("--config <address>", "Config PDA address")
    .option("--action <type>", "Filter by action type (mint, burn, freeze, thaw, pause, blacklist, seize, role)")
    .option("--limit <n>", "Number of recent signatures to scan", "20")
    .option("--cluster <url>", "Cluster URL")
    .option("--keypair <path>", "Keypair path")
    .action(async (opts) => {
      const s = spinner("Fetching audit log...");
      try {
        const connection = getConnection(opts.cluster);
        const authority = loadKeypair(opts.keypair);
        s.start();
        const stable = await SolanaStablecoin.load(connection, new PublicKey(opts.config), authority);

        const sigs = await connection.getSignaturesForAddress(
          stable.configPda,
          { limit: parseInt(opts.limit) },
          "confirmed"
        );

        s.stop();

        console.log(chalk.bold(`\n  Audit Log (${sigs.length} recent transactions)\n`));

        for (const sig of sigs) {
          const time = sig.blockTime
            ? new Date(sig.blockTime * 1000).toISOString()
            : "unknown";
          const status = sig.err ? chalk.red("FAIL") : chalk.green("OK");
          const memo = sig.memo || "";

          // Try to get transaction details to identify instruction type
          let action = "transaction";
          try {
            const tx = await connection.getParsedTransaction(sig.signature, {
              commitment: "confirmed",
              maxSupportedTransactionVersion: 0,
            });
            if (tx?.meta?.logMessages) {
              for (const log of tx.meta.logMessages) {
                if (log.includes("Instruction: Initialize")) action = "initialize";
                else if (log.includes("Instruction: Mint")) action = "mint";
                else if (log.includes("Instruction: Burn")) action = "burn";
                else if (log.includes("Instruction: FreezeAccount")) action = "freeze";
                else if (log.includes("Instruction: ThawAccount")) action = "thaw";
                else if (log.includes("Instruction: Pause")) action = "pause";
                else if (log.includes("Instruction: Unpause")) action = "unpause";
                else if (log.includes("Instruction: AddToBlacklist")) action = "blacklist";
                else if (log.includes("Instruction: RemoveFromBlacklist")) action = "unblacklist";
                else if (log.includes("Instruction: Seize")) action = "seize";
                else if (log.includes("Instruction: UpdateRoles")) action = "role";
                else if (log.includes("Instruction: UpdateMinter")) action = "minter";
                else if (log.includes("Instruction: ProposeAuthority")) action = "authority";
                else if (log.includes("Instruction: AcceptAuthority")) action = "authority";
              }
            }
          } catch {
            action = "unknown (parse error)";
          }

          if (opts.action && action !== opts.action) continue;

          console.log(
            `  ${time}  ${status}  ${chalk.cyan(action.padEnd(12))}  ${chalk.gray(sig.signature.slice(0, 20))}...`
          );
        }
        console.log();
      } catch (err: any) {
        s.stop();
        printError(err.message);
        process.exit(1);
      }
    });
}
