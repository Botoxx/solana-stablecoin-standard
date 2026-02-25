import { expect } from "chai";
import { loadConfig } from "../shared/config";

describe("loadConfig", () => {
  const origEnv: Record<string, string | undefined> = {};
  const REQUIRED_KEYS = ["RPC_URL", "PROGRAM_ID", "POSTGRES_URL"];

  beforeEach(() => {
    for (const key of [...REQUIRED_KEYS, "HOOK_PROGRAM_ID", "REDIS_URL", "PORT"]) {
      origEnv[key] = process.env[key];
    }
    process.env.RPC_URL = "https://api.devnet.solana.com";
    process.env.PROGRAM_ID = "Fjv9YM4CUWFgQZQzLyD42JojLcDJ2yPG7WDEaR7U14n1";
    process.env.POSTGRES_URL = "postgresql://localhost:5432/sss";
  });

  afterEach(() => {
    for (const [key, val] of Object.entries(origEnv)) {
      if (val !== undefined) {
        process.env[key] = val;
      } else {
        delete process.env[key];
      }
    }
  });

  it("loads required env vars", () => {
    const config = loadConfig(3000);
    expect(config.rpcUrl).to.equal("https://api.devnet.solana.com");
    expect(config.programId).to.equal("Fjv9YM4CUWFgQZQzLyD42JojLcDJ2yPG7WDEaR7U14n1");
    expect(config.postgresUrl).to.equal("postgresql://localhost:5432/sss");
  });

  it("throws on missing RPC_URL", () => {
    delete process.env.RPC_URL;
    expect(() => loadConfig(3000)).to.throw("Missing required env var: RPC_URL");
  });

  it("throws on missing PROGRAM_ID", () => {
    delete process.env.PROGRAM_ID;
    expect(() => loadConfig(3000)).to.throw("Missing required env var: PROGRAM_ID");
  });

  it("throws on missing POSTGRES_URL", () => {
    delete process.env.POSTGRES_URL;
    expect(() => loadConfig(3000)).to.throw("Missing required env var: POSTGRES_URL");
  });

  it("uses default port when PORT env is not set", () => {
    delete process.env.PORT;
    const config = loadConfig(3001);
    expect(config.port).to.equal(3001);
  });

  it("overrides port with PORT env", () => {
    process.env.PORT = "9999";
    const config = loadConfig(3001);
    expect(config.port).to.equal(9999);
  });

  it("uses default HOOK_PROGRAM_ID when not set", () => {
    delete process.env.HOOK_PROGRAM_ID;
    const config = loadConfig(3000);
    expect(config.hookProgramId).to.equal("7z98ECJDGgRTZgnkX4iY8F6yqLBkiFKXJR2p51jrvUaj");
  });

  it("uses default REDIS_URL when not set", () => {
    delete process.env.REDIS_URL;
    const config = loadConfig(3000);
    expect(config.redisUrl).to.equal("redis://localhost:6379");
  });
});
