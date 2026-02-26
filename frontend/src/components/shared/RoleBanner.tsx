import { FC } from "react";
import { Link } from "react-router-dom";

export const RoleBanner: FC<{ roleName: string }> = ({ roleName }) => (
  <div className="rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/[0.04] px-3 py-2 text-xs text-[var(--color-warning)]">
    Your wallet needs the <strong className="capitalize">{roleName}</strong> role.{" "}
    <Link to="/roles" className="underline">Assign it on the Roles page</Link>.
  </div>
);
