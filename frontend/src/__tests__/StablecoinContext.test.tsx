import { describe, it, expect } from "vitest";
import { parseAnchorError } from "../context/StablecoinContext";

describe("parseAnchorError", () => {
  it("extracts known error code", () => {
    const err = new Error("Transaction failed: custom program error: 0x1770");
    // 0x1770 = 6000 = Unauthorized
    expect(parseAnchorError(err)).toContain("Unauthorized");
  });

  it("extracts Paused error", () => {
    const err = new Error("custom program error: 0x1771");
    expect(parseAnchorError(err)).toContain("paused");
  });

  it("handles wallet rejection", () => {
    const err = new Error("User rejected the request.");
    expect(parseAnchorError(err)).toBe("Transaction rejected by wallet");
  });

  it("handles expired blockhash", () => {
    const err = new Error("Blockhash not found");
    expect(parseAnchorError(err)).toContain("expired");
  });

  it("handles insufficient funds", () => {
    const err = new Error("insufficient funds for rent");
    expect(parseAnchorError(err)).toContain("Insufficient SOL");
  });

  it("truncates long unknown messages", () => {
    const err = new Error("a".repeat(200));
    const result = parseAnchorError(err);
    expect(result.length).toBeLessThanOrEqual(123); // 120 + "..."
  });

  it("passes short unknown messages through", () => {
    const err = new Error("Something went wrong");
    expect(parseAnchorError(err)).toBe("Something went wrong");
  });

  it("handles non-Error types", () => {
    expect(parseAnchorError("string error")).toBe("string error");
    expect(parseAnchorError(42)).toBe("42");
  });
});
