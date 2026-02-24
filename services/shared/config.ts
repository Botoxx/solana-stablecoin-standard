export interface ServiceConfig {
  rpcUrl: string;
  programId: string;
  hookProgramId: string;
  postgresUrl: string;
  redisUrl: string;
  port: number;
}

export function loadConfig(defaultPort: number): ServiceConfig {
  const required = (key: string): string => {
    const val = process.env[key];
    if (!val) throw new Error(`Missing required env var: ${key}`);
    return val;
  };

  return {
    rpcUrl: process.env.RPC_URL || "http://127.0.0.1:8899",
    programId: process.env.PROGRAM_ID || "Fjv9YM4CUWFgQZQzLyD42JojLcDJ2yPG7WDEaR7U14n1",
    hookProgramId: process.env.HOOK_PROGRAM_ID || "7z98ECJDGgRTZgnkX4iY8F6yqLBkiFKXJR2p51jrvUaj",
    postgresUrl: process.env.POSTGRES_URL || "postgresql://sss:sss@localhost:5432/sss",
    redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
    port: parseInt(process.env.PORT || String(defaultPort)),
  };
}
