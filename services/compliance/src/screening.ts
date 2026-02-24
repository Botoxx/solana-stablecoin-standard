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
  async screen(address: string): Promise<ScreeningResult> {
    // Stub implementation — integration point for OFAC SDN list
    // In production, this would:
    // 1. Query the OFAC SDN list API or local database
    // 2. Match against known sanctioned wallet addresses
    // 3. Return detailed match information
    return {
      address,
      flagged: false,
      source: "OFAC_SDN",
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
