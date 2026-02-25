import { expect } from "chai";
import {
  OFACScreeningProvider,
  CompositeScreeningProvider,
  ScreeningProvider,
  ScreeningResult,
} from "../compliance/src/screening";

describe("OFACScreeningProvider", () => {
  const origUrl = process.env.OFAC_API_URL;
  afterEach(() => {
    if (origUrl !== undefined) {
      process.env.OFAC_API_URL = origUrl;
    } else {
      delete process.env.OFAC_API_URL;
    }
  });

  it("returns unflagged result in stub mode", async () => {
    delete process.env.OFAC_API_URL;
    const provider = new OFACScreeningProvider();
    const result = await provider.screen("11111111111111111111111111111111");
    expect(result.flagged).to.be.false;
    expect(result.address).to.equal("11111111111111111111111111111111");
  });

  it("labels source as OFAC_SDN_STUB when no API URL", async () => {
    delete process.env.OFAC_API_URL;
    const provider = new OFACScreeningProvider();
    const result = await provider.screen("test-address");
    expect(result.source).to.equal("OFAC_SDN_STUB");
  });

  it("labels source as OFAC_SDN when API URL is set", async () => {
    process.env.OFAC_API_URL = "https://ofac.example.com/api";
    const provider = new OFACScreeningProvider();
    const result = await provider.screen("test-address");
    expect(result.source).to.equal("OFAC_SDN");
  });
});

describe("CompositeScreeningProvider", () => {
  function mockProvider(flagged: boolean, source: string): ScreeningProvider {
    return {
      async screen(address: string): Promise<ScreeningResult> {
        return { address, flagged, source };
      },
    };
  }

  it("returns clean when all providers pass", async () => {
    const composite = new CompositeScreeningProvider([
      mockProvider(false, "provider-a"),
      mockProvider(false, "provider-b"),
    ]);
    const result = await composite.screen("test-addr");
    expect(result.flagged).to.be.false;
    expect(result.source).to.equal("composite");
  });

  it("returns flagged from first flagging provider", async () => {
    const composite = new CompositeScreeningProvider([
      mockProvider(false, "provider-a"),
      mockProvider(true, "provider-b"),
    ]);
    const result = await composite.screen("test-addr");
    expect(result.flagged).to.be.true;
    expect(result.source).to.equal("provider-b");
  });

  it("short-circuits on first flag", async () => {
    let secondCalled = false;
    const composite = new CompositeScreeningProvider([
      mockProvider(true, "provider-a"),
      {
        async screen(address: string): Promise<ScreeningResult> {
          secondCalled = true;
          return { address, flagged: false, source: "provider-b" };
        },
      },
    ]);
    const result = await composite.screen("test-addr");
    expect(result.flagged).to.be.true;
    expect(secondCalled).to.be.false;
  });

  it("returns clean with no providers", async () => {
    const composite = new CompositeScreeningProvider([]);
    const result = await composite.screen("test-addr");
    expect(result.flagged).to.be.false;
    expect(result.source).to.equal("composite");
  });
});
