import { FC } from "react";
import { useStablecoinContext } from "../../context/StablecoinContext";
import { useTransactionToast } from "../../hooks/useTransactionToast";

export const PausePanel: FC = () => {
  const { stablecoin, state } = useStablecoinContext();
  const { execute } = useTransactionToast();

  const handlePause = () => execute("Pausing system", () => stablecoin!.pause());
  const handleUnpause = () => execute("Unpausing system", () => stablecoin!.unpause());

  if (!stablecoin || !state) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-300">Pause Control</h3>
      <div className="flex items-center gap-4">
        <span className={`text-sm font-medium ${state.paused ? "text-amber-400" : "text-emerald-400"}`}>
          Status: {state.paused ? "PAUSED" : "ACTIVE"}
        </span>
        {state.paused ? (
          <button
            onClick={handleUnpause}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Unpause
          </button>
        ) : (
          <button
            onClick={handlePause}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
          >
            Pause
          </button>
        )}
      </div>
      {state.paused && (
        <p className="text-xs text-amber-400/70">
          Minting, burning, and transfers are disabled while paused. Compliance operations (seize) remain active.
        </p>
      )}
    </div>
  );
};
