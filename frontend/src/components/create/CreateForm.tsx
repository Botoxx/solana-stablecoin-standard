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
    const success = await createStablecoin({
      name,
      symbol,
      uri: uri || undefined,
      decimals: Number(decimals),
      preset,
      treasury: treasury ? new PublicKey(treasury) : undefined,
    });
    if (success) navigate("/");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Create Stablecoin</h1>
        <p className="mt-1 text-sm text-slate-500">Deploy a new stablecoin with Token-2022 extensions</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <p className="section-title mb-3">Preset</p>
          <PresetSelector value={preset} onChange={setPreset} />
        </div>

        <div className="card space-y-4">
          <p className="section-title">Token Metadata</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Name</label>
              <input required maxLength={32} value={name} onChange={(e) => setName(e.target.value)} placeholder="My USD" className="input" />
            </div>
            <div>
              <label className="label">Symbol</label>
              <input required maxLength={10} value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="MUSD" className="input" />
            </div>
          </div>
          <div>
            <label className="label">URI (optional)</label>
            <input maxLength={200} value={uri} onChange={(e) => setUri(e.target.value)} placeholder="https://..." className="input" />
          </div>
          <div className="w-32">
            <label className="label">Decimals</label>
            <input type="number" min={0} max={18} value={decimals} onChange={(e) => setDecimals(e.target.value)} className="input font-mono text-center" />
          </div>
        </div>

        <div className="card">
          <AddressInput label="Treasury (defaults to your wallet)" value={treasury} onChange={setTreasury} placeholder="Leave empty for your wallet" />
        </div>

        <button
          type="submit"
          disabled={loading || !name || !symbol}
          className="btn btn-primary w-full py-3"
        >
          {loading && <LoadingSpinner className="h-4 w-4" />}
          Create Stablecoin
        </button>
      </form>
    </div>
  );
};
