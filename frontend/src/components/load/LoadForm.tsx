import { FC, FormEvent, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useStablecoinContext } from "../../context/StablecoinContext";
import { AddressInput } from "../shared/AddressInput";
import { LoadingSpinner } from "../shared/LoadingSpinner";
import { useNavigate } from "react-router-dom";

export const LoadForm: FC = () => {
  const { loadStablecoin, loading } = useStablecoinContext();
  const navigate = useNavigate();
  const [configPda, setConfigPda] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const pk = new PublicKey(configPda);
      await loadStablecoin(pk);
      navigate("/");
    } catch {
      // AddressInput already validates
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-xl font-semibold">Load Stablecoin</h1>
      <form onSubmit={handleSubmit} className="space-y-5">
        <AddressInput
          label="Config PDA Address"
          value={configPda}
          onChange={setConfigPda}
          placeholder="Paste the config PDA..."
        />
        <button
          type="submit"
          disabled={loading || !configPda}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading && <LoadingSpinner className="h-4 w-4" />}
          Load
        </button>
      </form>
    </div>
  );
};
