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
    rpcUrl: required("RPC_URL"),
    programId: required("PROGRAM_ID"),
    hookProgramId: process.env.HOOK_PROGRAM_ID || "7z98ECJDGgRTZgnkX4iY8F6yqLBkiFKXJR2p51jrvUaj",
    postgresUrl: required("POSTGRES_URL"),
    redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
    port: parseInt(process.env.PORT || String(defaultPort)),
  };
}
