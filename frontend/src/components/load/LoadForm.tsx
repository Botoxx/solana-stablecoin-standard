import { FC, FormEvent, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useStablecoinContext } from "../../context/StablecoinContext";
import { useToast } from "../../context/ToastContext";
import { AddressInput } from "../shared/AddressInput";
import { LoadingSpinner } from "../shared/LoadingSpinner";
import { useNavigate } from "react-router-dom";

export const LoadForm: FC = () => {
  const { loadStablecoin, loading } = useStablecoinContext();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [configPda, setConfigPda] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    let pda: PublicKey;
    try {
      pda = new PublicKey(configPda);
    } catch {
      addToast("error", "Invalid config PDA address");
      return;
    }
    const success = await loadStablecoin(pda);
    if (success) navigate("/");
  };

  return (
    <div className="mx-auto max-w-xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Load Stablecoin</h1>
        <p className="mt-1 text-sm text-slate-500">Connect to an existing stablecoin by its config address</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card">
          <AddressInput label="Config PDA Address" value={configPda} onChange={setConfigPda} placeholder="Paste the config PDA..." />
        </div>
        <button type="submit" disabled={loading || !configPda} className="btn btn-primary w-full py-3">
          {loading && <LoadingSpinner className="h-4 w-4" />}
          Load
        </button>
      </form>
    </div>
  );
};
