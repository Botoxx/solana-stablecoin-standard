export interface ScreeningResult {
  address: string;
  flagged: boolean;
  source: string;
  matchType?: string;
  details?: string;
}

export interface ScreeningProvider {
  screen(address: string): Promise<ScreeningResult>;
}

export class OFACScreeningProvider implements ScreeningProvider {
  private apiUrl: string | undefined;

  constructor() {
    this.apiUrl = process.env.OFAC_API_URL;
    if (!this.apiUrl) {
      console.warn(
        "[COMPLIANCE WARNING] OFACScreeningProvider is in STUB mode — all addresses pass screening. " +
        "Set OFAC_API_URL env var for real OFAC SDN screening."
      );
    }
  }

  async screen(address: string): Promise<ScreeningResult> {
    if (!this.apiUrl) {
      // Stub mode — no API configured, return unflagged with explicit stub label
      return { address, flagged: false, source: "OFAC_SDN_STUB" };
    }

    // Real OFAC API call. If the integration is not yet implemented, fail loud
    // rather than returning a false "clean" result that creates a fraudulent
    // compliance record in the audit log.
    try {
      const response = await fetch(`${this.apiUrl}/screen?address=${encodeURIComponent(address)}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        throw new Error(`OFAC API returned ${response.status}`);
      }
      const data = await response.json() as { flagged?: boolean; matchType?: string };
      return {
        address,
        flagged: !!data.flagged,
        source: "OFAC_SDN",
        matchType: data.matchType,
      };
    } catch (err: any) {
      // Fail closed: if the OFAC API is unreachable, do NOT return "clean".
      // Throw so the caller can decide whether to block or retry.
      throw new Error(`OFAC screening failed for ${address}: ${err.message}`);
    }
  }
}

export class CompositeScreeningProvider implements ScreeningProvider {
  constructor(private providers: ScreeningProvider[]) {}

  async screen(address: string): Promise<ScreeningResult> {
    for (const provider of this.providers) {
      const result = await provider.screen(address);
      if (result.flagged) return result;
    }
    return { address, flagged: false, source: "composite" };
  }
}
