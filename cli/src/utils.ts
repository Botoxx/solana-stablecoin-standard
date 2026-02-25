import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, clusterApiUrl } from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import chalk from "chalk";
import ora from "ora";

export function loadKeypair(keypairPath?: string): Keypair {
  const resolvedPath =
    keypairPath ||
    process.env.ANCHOR_WALLET ||
    path.join(os.homedir(), ".config", "solana", "id.json");

  if (!fs.existsSync(resolvedPath)) {
    console.error(chalk.red(`Keypair not found: ${resolvedPath}`));
    console.error(chalk.gray("Run: solana-keygen new"));
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(resolvedPath, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

export function getConnection(cluster?: string): Connection {
  const url =
    cluster ||
    process.env.ANCHOR_PROVIDER_URL ||
    "http://127.0.0.1:8899";

  if (url === "devnet") return new Connection(clusterApiUrl("devnet"), "confirmed");
  if (url === "mainnet-beta") return new Connection(clusterApiUrl("mainnet-beta"), "confirmed");
  return new Connection(url, "confirmed");
}

export function getProvider(cluster?: string, keypairPath?: string): anchor.AnchorProvider {
  const connection = getConnection(cluster);
  const wallet = new anchor.Wallet(loadKeypair(keypairPath));
  return new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
}

export function getPayer(provider: anchor.AnchorProvider): Keypair {
  const payer = (provider.wallet as anchor.Wallet).payer;
  if (!payer) throw new Error("Wallet has no payer keypair");
  return payer;
}

export function spinner(text: string) {
  return ora({ text, color: "cyan" });
}

export function formatTokenAmount(amount: string | bigint, decimals: number): string {
  const str = amount.toString().padStart(decimals + 1, "0");
  const intPart = str.slice(0, str.length - decimals) || "0";
  const decPart = str.slice(str.length - decimals);
  return `${intPart}.${decPart}`;
}

export function parseTokenAmount(amount: string, decimals: number): anchor.BN {
  const parts = amount.split(".");
  const intPart = parts[0] || "0";
  const decPart = (parts[1] || "").padEnd(decimals, "0").slice(0, decimals);
  return new anchor.BN(intPart + decPart);
}

export function printSuccess(msg: string, sig?: string) {
  console.log(chalk.green("  ") + msg);
  if (sig) console.log(chalk.gray(`  tx: ${sig}`));
}

export function printError(msg: string) {
  console.error(chalk.red("  ") + msg);
}

/**
 * Parse a simple TOML config file into a flat key-value map.
 * Supports: key = "value", key = value, comments (#), [section] headers (ignored).
 */
export function parseTomlConfig(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    console.error(chalk.red(`Config file not found: ${filePath}`));
    process.exit(1);
  }
  const content = fs.readFileSync(filePath, "utf-8");
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("[")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Strip quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }
  return result;
}
