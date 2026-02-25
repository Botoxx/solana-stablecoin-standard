import { assert } from "chai";
import { PRESET_EXTENSIONS, resolveExtensions } from "../src/presets";
import { Presets } from "../src/types";

describe("SDK — Presets", () => {
  describe("PRESET_EXTENSIONS", () => {
    it("SSS-1 has no compliance extensions", () => {
      const sss1 = PRESET_EXTENSIONS[Presets.SSS_1];
      assert.isFalse(sss1.permanentDelegate);
      assert.isFalse(sss1.transferHook);
      assert.isFalse(sss1.defaultAccountFrozen);
    });

    it("SSS-2 has permanentDelegate and transferHook enabled", () => {
      const sss2 = PRESET_EXTENSIONS[Presets.SSS_2];
      assert.isTrue(sss2.permanentDelegate);
      assert.isTrue(sss2.transferHook);
      assert.isFalse(sss2.defaultAccountFrozen);
    });
  });

  describe("resolveExtensions", () => {
    it("returns SSS-1 defaults when no preset or extensions given", () => {
      const ext = resolveExtensions();
      assert.isFalse(ext.permanentDelegate);
      assert.isFalse(ext.transferHook);
      assert.isFalse(ext.defaultAccountFrozen);
    });

    it("returns SSS-2 extensions when SSS-2 preset selected", () => {
      const ext = resolveExtensions(Presets.SSS_2);
      assert.isTrue(ext.permanentDelegate);
      assert.isTrue(ext.transferHook);
      assert.isFalse(ext.defaultAccountFrozen);
    });

    it("extensions override preset values", () => {
      const ext = resolveExtensions(Presets.SSS_2, {
        permanentDelegate: false,
      });
      assert.isFalse(ext.permanentDelegate);
      assert.isTrue(ext.transferHook); // not overridden
    });

    it("defaultAccountFrozen can be enabled via extensions", () => {
      const ext = resolveExtensions(Presets.SSS_1, {
        defaultAccountFrozen: true,
      });
      assert.isTrue(ext.defaultAccountFrozen);
      assert.isFalse(ext.permanentDelegate);
    });

    it("custom extensions without preset default to SSS-1 base", () => {
      const ext = resolveExtensions(undefined, { transferHook: true });
      assert.isTrue(ext.transferHook);
      assert.isFalse(ext.permanentDelegate); // SSS-1 default
    });
  });
});
