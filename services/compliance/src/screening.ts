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
  private isStub: boolean;

  constructor() {
    this.isStub = !process.env.OFAC_API_URL;
    if (this.isStub) {
      console.warn(
        "[COMPLIANCE WARNING] OFACScreeningProvider is in STUB mode — all addresses pass screening. " +
        "Set OFAC_API_URL env var for real OFAC SDN screening."
      );
    }
  }

  async screen(address: string): Promise<ScreeningResult> {
    // Stub implementation — integration point for OFAC SDN list
    // In production, set OFAC_API_URL to enable real screening
    return {
      address,
      flagged: false,
      source: this.isStub ? "OFAC_SDN_STUB" : "OFAC_SDN",
    };
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
