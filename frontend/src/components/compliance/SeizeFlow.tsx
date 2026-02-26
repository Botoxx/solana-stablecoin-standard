import { FC, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { useStablecoinContext } from "../../context/StablecoinContext";
import { useTransactionToast } from "../../hooks/useTransactionToast";
import { AddressInput } from "../shared/AddressInput";
import { AmountInput } from "../shared/AmountInput";
import { RoleBanner } from "../shared/RoleBanner";
import { useRoleCheck } from "../../hooks/useRoleCheck";
import { RoleType } from "../../lib/constants";

type Step = "input" | "confirm" | "done";

export const SeizeFlow: FC = () => {
  const { stablecoin, state } = useStablecoinContext();
  const { execute } = useTransactionToast();
  const { hasRole, roleName } = useRoleCheck(RoleType.Seizer);
  const [step, setStep] = useState<Step>("input");
  const [source, setSource] = useState("");
  const [amount, setAmount] = useState("");
  const [signature, setSignature] = useState("");

  if (!state?.enablePermanentDelegate) return null;

  const handleConfirm = async () => {
    if (!stablecoin || !state) return;
    const sig = await execute("Seizing tokens", () =>
      stablecoin.seize(
        new PublicKey(source),
        state.treasury,
        new BN(Math.floor(parseFloat(amount) * 10 ** state.decimals)),
      ),
    );
    if (sig) {
      setSignature(sig);
      setStep("done");
    }
  };

  const reset = () => { setStep("input"); setSource(""); setAmount(""); setSignature(""); };

  // Step indicator
  const steps = ["Source", "Confirm", "Done"];
  const stepIndex = step === "input" ? 0 : step === "confirm" ? 1 : 2;

  return (
    <div className="space-y-4">
      <p className="section-title text-[var(--color-danger)]">Seize Tokens</p>

      {hasRole === false && <RoleBanner roleName={roleName} />}

      {/* Step indicator */}
      <div className="flex items-center gap-1 text-[10px]">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            {i > 0 && <div className={`h-px w-4 ${i <= stepIndex ? "bg-[var(--color-danger)]" : "bg-[var(--color-border)]"}`} />}
            <span className={`rounded-full px-2 py-0.5 font-medium ${
              i <= stepIndex ? "bg-[var(--color-danger)]/10 text-[var(--color-danger)]" : "bg-[var(--color-bg-surface)] text-slate-500"
            }`}>{s}</span>
          </div>
        ))}
      </div>

      {step === "input" && (
        <div className="space-y-4 animate-fade-in">
          <p className="text-xs text-slate-500">Target account must be frozen first.</p>
          <AddressInput label="Source Wallet Address (must be frozen)" value={source} onChange={setSource} />
          <AmountInput label="Amount" value={amount} onChange={setAmount} />
          <button onClick={() => setStep("confirm")} disabled={!source || !amount} className="btn btn-danger w-full">
            Review Seizure
          </button>
        </div>
      )}

      {step === "confirm" && (
        <div className="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/[0.03] p-4 space-y-4 animate-slide-up">
          <p className="text-sm font-medium text-[var(--color-danger)]">Confirm Seizure</p>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between border-b border-[var(--color-border)] pb-2">
              <span className="text-slate-500">Source</span>
              <span className="mono-data">{source.slice(0, 12)}...</span>
            </div>
            <div className="flex justify-between border-b border-[var(--color-border)] pb-2">
              <span className="text-slate-500">Amount</span>
              <span className="mono-data">{amount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Treasury</span>
              <span className="mono-data">{state?.treasury.toBase58().slice(0, 12)}...</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleConfirm} className="btn btn-danger flex-1">
              Confirm Seize
            </button>
            <button onClick={() => setStep("input")} className="btn btn-ghost flex-1">
              Back
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/[0.03] p-4 space-y-3 animate-slide-up">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm font-medium text-[var(--color-accent)]">Seizure Complete</p>
          </div>
          <p className="mono-data text-slate-400">
            {signature.slice(0, 24)}...
          </p>
          <button onClick={reset} className="btn btn-ghost text-xs">
            New Seizure
          </button>
        </div>
      )}
    </div>
  );
};
