import { FC, FormEvent, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useStablecoinContext } from "../../context/StablecoinContext";
import { PresetSelector } from "./PresetSelector";
import { AddressInput } from "../shared/AddressInput";
import { LoadingSpinner } from "../shared/LoadingSpinner";
import type { Preset } from "../../lib/constants";
import { Presets } from "../../lib/constants";
import { useNavigate } from "react-router-dom";

export const CreateForm: FC = () => {
  const { createStablecoin, loading } = useStablecoinContext();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [uri, setUri] = useState("");
  const [decimals, setDecimals] = useState("6");
  const [preset, setPreset] = useState<Preset>(Presets.SSS_1);
  const [treasury, setTreasury] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await createStablecoin({
      name,
      symbol,
      uri: uri || undefined,
      decimals: Number(decimals),
      preset,
      treasury: treasury ? new PublicKey(treasury) : undefined,
    });
    navigate("/");
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-xl font-semibold">Create Stablecoin</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <PresetSelector value={preset} onChange={setPreset} />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Name</label>
            <input
              required
              maxLength={32}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My USD"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Symbol</label>
            <input
              required
              maxLength={10}
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="MUSD"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">URI (optional)</label>
          <input
            maxLength={200}
            value={uri}
            onChange={(e) => setUri(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Decimals</label>
            <input
              type="number"
              min={0}
              max={18}
              value={decimals}
              onChange={(e) => setDecimals(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
            />
          </div>
          <div />
        </div>

        <AddressInput
          label="Treasury (defaults to your wallet)"
          value={treasury}
          onChange={setTreasury}
          placeholder="Leave empty for your wallet"
        />

        <button
          type="submit"
          disabled={loading || !name || !symbol}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading && <LoadingSpinner className="h-4 w-4" />}
          Create Stablecoin
        </button>
      </form>
    </div>
  );
};
