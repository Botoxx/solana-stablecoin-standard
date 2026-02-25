import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { SolanaStablecoin } from "@stbr/sss-token";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import chalk from "chalk";
import { getConnection, loadKeypair, spinner, printError, formatTokenAmount } from "../utils";

export function registerHolders(program: Command) {
  program
    .command("holders")
    .description("List token holders")
    .requiredOption("--config <address>", "Config PDA address")
    .option("--min-balance <amount>", "Minimum balance filter (human-readable)")
    .option("--cluster <url>", "Cluster URL")
    .option("--keypair <path>", "Keypair path")
    .action(async (opts) => {
      const s = spinner("Fetching holders...");
      try {
        const connection = getConnection(opts.cluster);
        const authority = loadKeypair(opts.keypair);
        s.start();
        const stable = await SolanaStablecoin.load(connection, new PublicKey(opts.config), authority);
        const config = await stable.getConfig();

        // Filter by mint field at offset 0 only — Token-2022 accounts with
        // extensions (transfer hook, permanent delegate) are larger than 165
        // bytes, so a dataSize filter would miss all SSS-2 token accounts.
        const accounts = await connection.getParsedProgramAccounts(
          TOKEN_2022_PROGRAM_ID,
          {
            filters: [
              { memcmp: { offset: 0, bytes: stable.mintAddress.toBase58() } },
            ],
          }
        );

        s.stop();

        const minBalance = opts.minBalance
          ? BigInt(
              Math.floor(parseFloat(opts.minBalance) * 10 ** config.decimals)
            )
          : BigInt(0);

        type ParsedAccountData = {
          parsed: {
            info: {
              owner: string;
              tokenAmount: { amount: string; uiAmountString: string };
            };
          };
        };

        const holders = accounts
          .map((a) => {
            const data = a.account.data as unknown as ParsedAccountData;
            return {
              address: a.pubkey.toBase58(),
              owner: data.parsed.info.owner,
              balance: BigInt(data.parsed.info.tokenAmount.amount),
              display: data.parsed.info.tokenAmount.uiAmountString,
            };
          })
          .filter((h) => h.balance > minBalance)
          .sort((a, b) => (b.balance > a.balance ? 1 : -1));

        console.log(chalk.bold(`\n  Token Holders (${holders.length})\n`));
        for (const h of holders) {
          console.log(`  ${h.owner}  ${formatTokenAmount(h.balance.toString(), config.decimals)}`);
        }
        if (holders.length === 0) {
          console.log(chalk.gray("  No holders found"));
        }
        console.log();
      } catch (err: any) {
        s.stop();
        printError(err.message);
        process.exit(1);
      }
    });
}
