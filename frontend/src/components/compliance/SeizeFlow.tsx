import { FC, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { useStablecoinContext } from "../../context/StablecoinContext";
import { useTransactionToast } from "../../hooks/useTransactionToast";
import { AddressInput } from "../shared/AddressInput";
import { AmountInput } from "../shared/AmountInput";

type Step = "input" | "confirm" | "done";

export const SeizeFlow: FC = () => {
  const { stablecoin, state } = useStablecoinContext();
  const { execute } = useTransactionToast();
  const [step, setStep] = useState<Step>("input");
  const [source, setSource] = useState("");
  const [amount, setAmount] = useState("");
  const [signature, setSignature] = useState("");

  if (!state?.enablePermanentDelegate) return null;

  const handleConfirm = async () => {
    if (!stablecoin || !state) return;
    const treasuryAta = stablecoin.getAssociatedTokenAddress(state.treasury);
    const sig = await execute("Seizing tokens", () =>
      stablecoin.seize(
        new PublicKey(source),
        treasuryAta,
        new BN(Math.floor(parseFloat(amount) * 10 ** state.decimals)),
      ),
    );
    if (sig) {
      setSignature(sig);
      setStep("done");
    }
  };

  const reset = () => {
    setStep("input");
    setSource("");
    setAmount("");
    setSignature("");
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-rose-400">Seize Tokens</h3>
      <p className="text-xs text-slate-500">
        Seize tokens from a frozen account to the treasury. The account must be frozen first.
      </p>

      {step === "input" && (
        <div className="space-y-4">
          <AddressInput label="Source Token Account (frozen)" value={source} onChange={setSource} />
          <AmountInput label="Amount" value={amount} onChange={setAmount} />
          <button
            onClick={() => setStep("confirm")}
            disabled={!source || !amount}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
          >
            Review
          </button>
        </div>
      )}

      {step === "confirm" && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 space-y-3">
          <p className="text-sm font-medium text-rose-300">Confirm Seizure</p>
          <div className="text-xs text-slate-400 space-y-1">
            <p>Source: <span className="font-mono text-slate-300">{source.slice(0, 8)}...</span></p>
            <p>Amount: <span className="text-slate-300">{amount}</span></p>
            <p>Treasury: <span className="font-mono text-slate-300">{state?.treasury.toBase58().slice(0, 8)}...</span></p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
            >
              Confirm Seize
            </button>
            <button
              onClick={() => setStep("input")}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
          <p className="text-sm font-medium text-emerald-400">Seizure Complete</p>
          <p className="text-xs text-slate-400">
            Signature: <span className="font-mono text-slate-300">{signature.slice(0, 16)}...</span>
          </p>
          <button
            onClick={reset}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            New Seizure
          </button>
        </div>
      )}
    </div>
  );
};
