import { expect } from "chai";
import { Keypair } from "@solana/web3.js";
import {
  isValidPubkey,
  isValidAmount,
  ipToNum,
  isPrivateIp,
  isValidWebhookUrl,
} from "../shared/validation";

describe("isValidPubkey", () => {
  it("accepts valid base58 pubkey", () => {
    const kp = Keypair.generate();
    expect(isValidPubkey(kp.publicKey.toBase58())).to.be.true;
  });

  it("accepts system program ID", () => {
    expect(isValidPubkey("11111111111111111111111111111111")).to.be.true;
  });

  it("rejects empty string", () => {
    expect(isValidPubkey("")).to.be.false;
  });

  it("rejects random text", () => {
    expect(isValidPubkey("not-a-pubkey")).to.be.false;
  });

  it("rejects string with invalid base58 characters", () => {
    expect(isValidPubkey("0OIl")).to.be.false;
  });
});

describe("isValidAmount", () => {
  it("accepts '1'", () => {
    expect(isValidAmount("1")).to.be.true;
  });

  it("accepts large amount within u64", () => {
    expect(isValidAmount("1000000000000")).to.be.true;
  });

  it("accepts u64 max", () => {
    expect(isValidAmount("18446744073709551615")).to.be.true;
  });

  it("rejects zero", () => {
    expect(isValidAmount("0")).to.be.false;
  });

  it("rejects empty string", () => {
    expect(isValidAmount("")).to.be.false;
  });

  it("rejects negative", () => {
    expect(isValidAmount("-1")).to.be.false;
  });

  it("rejects non-numeric", () => {
    expect(isValidAmount("abc")).to.be.false;
  });

  it("rejects float", () => {
    expect(isValidAmount("1.5")).to.be.false;
  });

  it("rejects u64 overflow (max + 1)", () => {
    expect(isValidAmount("18446744073709551616")).to.be.false;
  });

  it("rejects large overflow", () => {
    expect(isValidAmount("99999999999999999999999")).to.be.false;
  });

  it("rejects string with leading spaces", () => {
    expect(isValidAmount(" 100")).to.be.false;
  });

  it("rejects hex string", () => {
    expect(isValidAmount("0xff")).to.be.false;
  });
});

describe("ipToNum", () => {
  it("converts 0.0.0.0 to 0", () => {
    expect(ipToNum("0.0.0.0")).to.equal(0);
  });

  it("converts 255.255.255.255 to 4294967295", () => {
    expect(ipToNum("255.255.255.255")).to.equal(4294967295);
  });

  it("converts 10.0.0.1 correctly", () => {
    expect(ipToNum("10.0.0.1")).to.equal(167772161);
  });

  it("converts 127.0.0.1 correctly", () => {
    expect(ipToNum("127.0.0.1")).to.equal(2130706433);
  });
});

describe("isPrivateIp", () => {
  // 10.0.0.0/8
  it("detects 10.0.0.1 as private", () => {
    expect(isPrivateIp("10.0.0.1")).to.be.true;
  });

  it("detects 10.255.255.255 as private", () => {
    expect(isPrivateIp("10.255.255.255")).to.be.true;
  });

  // 172.16.0.0/12
  it("detects 172.16.0.1 as private", () => {
    expect(isPrivateIp("172.16.0.1")).to.be.true;
  });

  it("detects 172.31.255.255 as private", () => {
    expect(isPrivateIp("172.31.255.255")).to.be.true;
  });

  it("allows 172.32.0.1 (outside /12 range)", () => {
    expect(isPrivateIp("172.32.0.1")).to.be.false;
  });

  // 192.168.0.0/16
  it("detects 192.168.1.1 as private", () => {
    expect(isPrivateIp("192.168.1.1")).to.be.true;
  });

  // 169.254.0.0/16 (link-local)
  it("detects 169.254.1.1 as private", () => {
    expect(isPrivateIp("169.254.1.1")).to.be.true;
  });

  // 127.0.0.0/8 (loopback)
  it("detects 127.0.0.1 as private", () => {
    expect(isPrivateIp("127.0.0.1")).to.be.true;
  });

  it("detects 127.255.255.255 as private", () => {
    expect(isPrivateIp("127.255.255.255")).to.be.true;
  });

  // Public IPs
  it("allows 8.8.8.8 (Google DNS)", () => {
    expect(isPrivateIp("8.8.8.8")).to.be.false;
  });

  it("allows 1.1.1.1 (Cloudflare)", () => {
    expect(isPrivateIp("1.1.1.1")).to.be.false;
  });

  it("allows 203.0.113.1 (documentation range, but public)", () => {
    expect(isPrivateIp("203.0.113.1")).to.be.false;
  });

  // Non-IPv4
  it("returns false for IPv6", () => {
    expect(isPrivateIp("::1")).to.be.false;
  });

  it("returns false for non-IP string", () => {
    expect(isPrivateIp("example.com")).to.be.false;
  });
});

describe("isValidWebhookUrl", () => {
  it("accepts valid https URL", () => {
    const result = isValidWebhookUrl("https://example.com/webhook");
    expect(result.valid).to.be.true;
  });

  it("accepts valid http URL", () => {
    const result = isValidWebhookUrl("http://example.com/webhook");
    expect(result.valid).to.be.true;
  });

  it("rejects invalid URL format", () => {
    const result = isValidWebhookUrl("not-a-url");
    expect(result.valid).to.be.false;
    expect(result.reason).to.include("Invalid URL");
  });

  it("rejects ftp protocol", () => {
    const result = isValidWebhookUrl("ftp://example.com/file");
    expect(result.valid).to.be.false;
    expect(result.reason).to.include("http/https");
  });

  it("rejects javascript: protocol", () => {
    const result = isValidWebhookUrl("javascript:alert(1)");
    expect(result.valid).to.be.false;
  });

  it("rejects URL with private IP (10.x)", () => {
    const result = isValidWebhookUrl("http://10.0.0.1:8080/hook");
    expect(result.valid).to.be.false;
    expect(result.reason).to.include("private");
  });

  it("rejects URL with private IP (192.168.x)", () => {
    const result = isValidWebhookUrl("https://192.168.1.100/hook");
    expect(result.valid).to.be.false;
    expect(result.reason).to.include("private");
  });

  it("rejects URL with loopback (127.0.0.1)", () => {
    const result = isValidWebhookUrl("http://127.0.0.1:3000/hook");
    expect(result.valid).to.be.false;
    expect(result.reason).to.include("private");
  });

  it("rejects localhost by hostname", () => {
    const result = isValidWebhookUrl("http://localhost:3000/hook");
    expect(result.valid).to.be.false;
    expect(result.reason).to.include("localhost");
  });

  it("rejects 0.0.0.0", () => {
    const result = isValidWebhookUrl("http://0.0.0.0:3000/hook");
    expect(result.valid).to.be.false;
    expect(result.reason).to.include("localhost");
  });

  it("accepts URL with public IP", () => {
    const result = isValidWebhookUrl("https://203.0.113.50:443/webhook");
    expect(result.valid).to.be.true;
  });

  it("rejects URL with link-local IP (169.254.x)", () => {
    const result = isValidWebhookUrl("http://169.254.169.254/latest/meta-data/");
    expect(result.valid).to.be.false;
    expect(result.reason).to.include("private");
  });
});
