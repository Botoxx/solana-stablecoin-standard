import { FC } from "react";

const Badge: FC<{ label: string; active: boolean }> = ({ label, active }) => (
  <span className={active ? "pill pill-success" : "pill pill-neutral"}>
    {active && (
      <svg className="mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    )}
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
