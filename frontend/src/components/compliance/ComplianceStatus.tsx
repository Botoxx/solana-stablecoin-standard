import { FC } from "react";
import { useStablecoinContext } from "../../context/StablecoinContext";

export const ComplianceStatus: FC = () => {
  const { state } = useStablecoinContext();
  if (!state) return null;

  const isCompliant = state.enablePermanentDelegate || state.enableTransferHook;

  if (!isCompliant) {
    return (
      <div className="card card-warning">
        <div className="flex items-start gap-3">
          <svg className="h-5 w-5 text-[var(--color-warning)] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-[var(--color-warning)]">Compliance Not Enabled</p>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              This is an SSS-1 stablecoin. Blacklist management and token seizure are not available.
              Create an SSS-2 stablecoin to enable compliance features.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card card-accent">
      <div className="flex items-start gap-3">
        <svg className="h-5 w-5 text-[var(--color-accent)] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <div>
          <p className="text-sm font-medium text-[var(--color-accent)]">SSS-2 Compliance Active</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {state.enablePermanentDelegate && <span className="pill pill-success">Permanent Delegate</span>}
            {state.enableTransferHook && <span className="pill pill-success">Transfer Hook</span>}
          </div>
        </div>
      </div>
    </div>
  );
};
