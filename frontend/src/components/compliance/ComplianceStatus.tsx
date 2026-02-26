import { FC } from "react";
import { useStablecoinContext } from "../../context/StablecoinContext";

export const ComplianceStatus: FC = () => {
  const { state } = useStablecoinContext();
  if (!state) return null;

  const isCompliant = state.enablePermanentDelegate || state.enableTransferHook;

  if (!isCompliant) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <p className="text-sm font-medium text-amber-400">Compliance Not Enabled</p>
        <p className="mt-1 text-xs text-amber-400/70">
          This is an SSS-1 stablecoin. Blacklist management and token seizure are not available.
          Create an SSS-2 stablecoin to enable compliance features.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
      <p className="text-sm font-medium text-emerald-400">SSS-2 Compliance Active</p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        {state.enablePermanentDelegate && (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-400">
            Permanent Delegate
          </span>
        )}
        {state.enableTransferHook && (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-400">
            Transfer Hook
          </span>
        )}
      </div>
    </div>
  );
};
