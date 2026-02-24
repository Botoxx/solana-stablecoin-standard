import { CreateStablecoinParams, Preset } from "./types";

export const PRESET_CONFIGS: Record<Preset, Omit<CreateStablecoinParams, "name" | "symbol" | "uri">> = {
  "sss-1": {
    decimals: 6,
    enablePermanentDelegate: false,
    enableTransferHook: false,
    defaultAccountFrozen: false,
  },
  "sss-2": {
    decimals: 6,
    enablePermanentDelegate: true,
    enableTransferHook: true,
    defaultAccountFrozen: false,
  },
};

export function getPresetConfig(
  preset: Preset,
  overrides: Partial<CreateStablecoinParams> = {}
): CreateStablecoinParams {
  const base = PRESET_CONFIGS[preset];
  return {
    name: overrides.name ?? `SSS ${preset.toUpperCase()} Token`,
    symbol: overrides.symbol ?? preset.toUpperCase(),
    uri: overrides.uri ?? "",
    ...base,
    ...overrides,
  };
}
