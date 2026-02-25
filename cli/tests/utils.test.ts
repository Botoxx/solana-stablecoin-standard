import { assert } from "chai";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { formatTokenAmount, parseTokenAmount, parseTomlConfig } from "../src/utils";

describe("CLI — Utility functions", () => {
  describe("formatTokenAmount", () => {
    it("formats zero correctly with 6 decimals", () => {
      assert.equal(formatTokenAmount("0", 6), "0.000000");
    });

    it("formats 1_000_000 (1.0 with 6 decimals)", () => {
      assert.equal(formatTokenAmount("1000000", 6), "1.000000");
    });

    it("formats large amounts correctly", () => {
      assert.equal(formatTokenAmount("123456789012", 6), "123456.789012");
    });

    it("formats small amounts correctly (< 1 token)", () => {
      assert.equal(formatTokenAmount("500", 6), "0.000500");
    });

    it("handles 0 decimals", () => {
      assert.equal(formatTokenAmount("42", 0), "42.");
    });

    it("handles 9 decimals (SOL-style)", () => {
      assert.equal(formatTokenAmount("1000000000", 9), "1.000000000");
    });
  });

  describe("parseTokenAmount", () => {
    it("parses '1.0' with 6 decimals to 1_000_000", () => {
      const bn = parseTokenAmount("1.0", 6);
      assert.equal(bn.toString(), "1000000");
    });

    it("parses integer amounts", () => {
      const bn = parseTokenAmount("100", 6);
      assert.equal(bn.toString(), "100000000");
    });

    it("parses small fractional amounts", () => {
      const bn = parseTokenAmount("0.001", 6);
      assert.equal(bn.toString(), "1000");
    });

    it("truncates excess decimal places", () => {
      const bn = parseTokenAmount("1.1234567", 6);
      assert.equal(bn.toString(), "1123456");
    });

    it("pads missing decimal places", () => {
      const bn = parseTokenAmount("1.5", 6);
      assert.equal(bn.toString(), "1500000");
    });
  });

  describe("parseTomlConfig", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sss-cli-test-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true });
    });

    it("parses key-value pairs", () => {
      const file = path.join(tmpDir, "config.toml");
      fs.writeFileSync(file, 'name = "TestCoin"\nsymbol = "TEST"\ndecimals = "9"\n');
      const result = parseTomlConfig(file);
      assert.equal(result.name, "TestCoin");
      assert.equal(result.symbol, "TEST");
      assert.equal(result.decimals, "9");
    });

    it("strips double quotes from values", () => {
      const file = path.join(tmpDir, "config.toml");
      fs.writeFileSync(file, 'name = "MyToken"\n');
      assert.equal(parseTomlConfig(file).name, "MyToken");
    });

    it("strips single quotes from values", () => {
      const file = path.join(tmpDir, "config.toml");
      fs.writeFileSync(file, "name = 'MyToken'\n");
      assert.equal(parseTomlConfig(file).name, "MyToken");
    });

    it("ignores comments", () => {
      const file = path.join(tmpDir, "config.toml");
      fs.writeFileSync(file, '# This is a comment\nname = "Test"\n# Another comment\n');
      const result = parseTomlConfig(file);
      assert.equal(result.name, "Test");
      assert.equal(Object.keys(result).length, 1);
    });

    it("ignores section headers", () => {
      const file = path.join(tmpDir, "config.toml");
      fs.writeFileSync(file, '[token]\nname = "Test"\n');
      const result = parseTomlConfig(file);
      assert.equal(result.name, "Test");
    });

    it("handles unquoted values", () => {
      const file = path.join(tmpDir, "config.toml");
      fs.writeFileSync(file, "permanent_delegate = true\ntransfer_hook = false\n");
      const result = parseTomlConfig(file);
      assert.equal(result.permanent_delegate, "true");
      assert.equal(result.transfer_hook, "false");
    });

    it("ignores empty lines", () => {
      const file = path.join(tmpDir, "config.toml");
      fs.writeFileSync(file, '\nname = "Test"\n\nsymbol = "T"\n\n');
      const result = parseTomlConfig(file);
      assert.equal(Object.keys(result).length, 2);
    });

    it("parses a complete SSS-2 config", () => {
      const file = path.join(tmpDir, "sss2.toml");
      fs.writeFileSync(
        file,
        [
          '# SSS-2 compliant stablecoin config',
          '[stablecoin]',
          'name = "Regulated USD"',
          'symbol = "RUSD"',
          'uri = "https://example.com/rusd.json"',
          'decimals = "6"',
          'preset = "sss-2"',
          'treasury = "11111111111111111111111111111112"',
          '',
        ].join("\n")
      );
      const result = parseTomlConfig(file);
      assert.equal(result.name, "Regulated USD");
      assert.equal(result.symbol, "RUSD");
      assert.equal(result.preset, "sss-2");
      assert.equal(result.decimals, "6");
      assert.equal(result.treasury, "11111111111111111111111111111112");
    });
  });
});
