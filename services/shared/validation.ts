import * as net from "net";
import { PublicKey } from "@solana/web3.js";

const MAX_U64 = "18446744073709551615";

export function isValidPubkey(s: string): boolean {
  try { new PublicKey(s); return true; } catch { return false; }
}

export function isValidAmount(s: string): boolean {
  if (!/^\d+$/.test(s)) return false;
  if (s.length > MAX_U64.length) return false;
  if (s.length === MAX_U64.length && s > MAX_U64) return false;
  return BigInt(s) > 0n;
}

const BLOCKED_IP_RANGES = [
  { start: "10.0.0.0", end: "10.255.255.255" },
  { start: "172.16.0.0", end: "172.31.255.255" },
  { start: "192.168.0.0", end: "192.168.255.255" },
  { start: "169.254.0.0", end: "169.254.255.255" },
  { start: "127.0.0.0", end: "127.255.255.255" },
];

export function ipToNum(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
}

export function isPrivateIp(ip: string): boolean {
  if (!net.isIPv4(ip)) return false;
  const num = ipToNum(ip);
  return BLOCKED_IP_RANGES.some(
    (r) => num >= ipToNum(r.start) && num <= ipToNum(r.end)
  );
}

export function isValidWebhookUrl(urlStr: string): { valid: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { valid: false, reason: "Invalid URL format" };
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { valid: false, reason: "Only http/https URLs are allowed" };
  }
  if (isPrivateIp(parsed.hostname)) {
    return { valid: false, reason: "URLs targeting private/internal IP ranges are not allowed" };
  }
  if (parsed.hostname === "localhost" || parsed.hostname === "0.0.0.0") {
    return { valid: false, reason: "URLs targeting localhost are not allowed" };
  }
  return { valid: true };
}
