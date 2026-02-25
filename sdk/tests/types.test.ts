import { assert } from "chai";
import { Presets, RoleType, ROLE_TYPE_NAMES } from "../src/types";

describe("SDK — Types and constants", () => {
  describe("Presets", () => {
    it("SSS_1 is 'sss-1'", () => {
      assert.equal(Presets.SSS_1, "sss-1");
    });

    it("SSS_2 is 'sss-2'", () => {
      assert.equal(Presets.SSS_2, "sss-2");
    });
  });

  describe("RoleType", () => {
    it("has correct numeric values", () => {
      assert.equal(RoleType.Minter, 0);
      assert.equal(RoleType.Burner, 1);
      assert.equal(RoleType.Pauser, 2);
      assert.equal(RoleType.Blacklister, 3);
      assert.equal(RoleType.Seizer, 4);
    });

    it("covers all 5 roles", () => {
      const roles = Object.keys(RoleType);
      assert.equal(roles.length, 5);
    });
  });

  describe("ROLE_TYPE_NAMES", () => {
    it("maps all role values to lowercase names", () => {
      assert.equal(ROLE_TYPE_NAMES[0], "minter");
      assert.equal(ROLE_TYPE_NAMES[1], "burner");
      assert.equal(ROLE_TYPE_NAMES[2], "pauser");
      assert.equal(ROLE_TYPE_NAMES[3], "blacklister");
      assert.equal(ROLE_TYPE_NAMES[4], "seizer");
    });

    it("has entries for all RoleType values", () => {
      for (const val of Object.values(RoleType)) {
        assert.isDefined(ROLE_TYPE_NAMES[val], `missing name for role ${val}`);
      }
    });
  });
});
