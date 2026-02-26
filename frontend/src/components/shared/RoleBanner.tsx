import { FC } from "react";

export const RoleBanner: FC<{ roleName: string }> = ({ roleName }) => (
  <div className="rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/[0.04] px-3 py-2 text-xs text-[var(--color-warning)]">
    Your wallet needs the <strong className="capitalize">{roleName}</strong> role.{" "}
    <a href="/roles" className="underline">Assign it on the Roles page</a>.
  </div>
);
