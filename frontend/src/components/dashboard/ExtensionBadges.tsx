import { FC } from "react";

const Badge: FC<{ label: string; active: boolean }> = ({ label, active }) => (
  <span
    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
      active
        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
        : "bg-slate-700/50 text-slate-500 border border-slate-700"
    }`}
  >
    {label}
  </span>
);

export const ExtensionBadges: FC<{
  permanentDelegate: boolean;
  transferHook: boolean;
  defaultAccountFrozen: boolean;
}> = ({ permanentDelegate, transferHook, defaultAccountFrozen }) => (
  <div className="flex flex-wrap gap-2">
    <Badge label="Permanent Delegate" active={permanentDelegate} />
    <Badge label="Transfer Hook" active={transferHook} />
    <Badge label="Default Frozen" active={defaultAccountFrozen} />
  </div>
);
