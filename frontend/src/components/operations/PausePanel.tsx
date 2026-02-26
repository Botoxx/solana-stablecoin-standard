import { FC } from "react";
import { useStablecoinContext } from "../../context/StablecoinContext";
import { useTransactionToast } from "../../hooks/useTransactionToast";
import { useRoleCheck } from "../../hooks/useRoleCheck";
import { RoleBanner } from "../shared/RoleBanner";
import { RoleType } from "../../lib/constants";

export const PausePanel: FC = () => {
  const { stablecoin, state } = useStablecoinContext();
  const { execute } = useTransactionToast();
  const { hasRole, roleName } = useRoleCheck(RoleType.Pauser);

  if (!stablecoin || !state) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-[var(--color-warning)]" />
        <h3 className="text-sm font-semibold text-slate-200">Pause Control</h3>
      </div>
      {hasRole === false && <RoleBanner roleName={roleName} />}
      <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`h-2.5 w-2.5 rounded-full ${state.paused ? "bg-[var(--color-warning)] animate-pulse-subtle" : "bg-[var(--color-accent)]"}`} />
          <span className="text-sm font-medium text-slate-200">
            {state.paused ? "System Paused" : "System Active"}
          </span>
        </div>
        {state.paused ? (
          <button onClick={() => execute("Unpausing", () => stablecoin.unpause())} className="btn btn-primary text-xs py-1.5 px-3">
            Unpause
          </button>
        ) : (
          <button onClick={() => execute("Pausing", () => stablecoin.pause())} className="btn btn-warning text-xs py-1.5 px-3">
            Pause
          </button>
        )}
      </div>
      {state.paused && (
        <p className="text-xs text-[var(--color-warning)]/70 leading-relaxed">
          Minting, burning, and transfers are disabled while paused. Compliance operations (seize) remain active per GENIUS Act requirements.
        </p>
      )}
    </div>
  );
};
