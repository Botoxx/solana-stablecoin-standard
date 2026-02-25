import { StablecoinExtensions, Preset, Presets } from "./types";

export const PRESET_EXTENSIONS: Record<Preset, Required<StablecoinExtensions>> = {
  [Presets.SSS_1]: {
    permanentDelegate: false,
    transferHook: false,
    defaultAccountFrozen: false,
  },
  [Presets.SSS_2]: {
    permanentDelegate: true,
    transferHook: true,
    defaultAccountFrozen: false,
  },
};

export function resolveExtensions(
  preset?: Preset,
  extensions?: StablecoinExtensions
): Required<StablecoinExtensions> {
  const base = preset ? PRESET_EXTENSIONS[preset] : PRESET_EXTENSIONS[Presets.SSS_1];
  return {
    permanentDelegate: extensions?.permanentDelegate ?? base.permanentDelegate,
    transferHook: extensions?.transferHook ?? base.transferHook,
    defaultAccountFrozen: extensions?.defaultAccountFrozen ?? base.defaultAccountFrozen,
  };
}
