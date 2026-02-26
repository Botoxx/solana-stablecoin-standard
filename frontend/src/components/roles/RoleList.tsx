import { FC, useCallback, useEffect, useState } from "react";
import { useStablecoinContext } from "../../context/StablecoinContext";
import type { RoleState } from "../../lib/stablecoin";
import { ROLE_TYPE_NAMES } from "../../lib/constants";
import { PublicKey } from "@solana/web3.js";

function shortAddr(a: string) { return `${a.slice(0, 4)}...${a.slice(-4)}`; }

export const RoleList: FC = () => {
  const { stablecoin } = useStablecoinContext();
  const [roles, setRoles] = useState<(RoleState & { publicKey: PublicKey })[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!stablecoin) return;
    setLoading(true);
    try { setRoles(await stablecoin.getAllRoles()); } catch { /* ignore */ }
    setLoading(false);
  }, [stablecoin]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!stablecoin) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="section-title">Role Assignments</p>
        <button onClick={refresh} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Refresh</button>
      </div>
      {loading ? (
        <p className="text-xs text-slate-500 animate-pulse-subtle">Loading...</p>
      ) : roles.length === 0 ? (
        <p className="text-xs text-slate-500 py-4 text-center">No roles assigned</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-base)]">
                <th className="px-3 py-2.5 text-left font-medium text-slate-500">Address</th>
                <th className="px-3 py-2.5 text-left font-medium text-slate-500">Role</th>
                <th className="px-3 py-2.5 text-left font-medium text-slate-500">Assigned By</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.publicKey.toBase58()} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-surface)] transition-colors">
                  <td className="px-3 py-2.5 mono-data">{shortAddr(r.address.toBase58())}</td>
                  <td className="px-3 py-2.5">
                    <span className="pill pill-neutral capitalize">{ROLE_TYPE_NAMES[r.roleType] ?? `Unknown(${r.roleType})`}</span>
                  </td>
                  <td className="px-3 py-2.5 mono-data text-slate-500">{shortAddr(r.assignedBy.toBase58())}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
