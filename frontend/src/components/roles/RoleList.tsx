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
    try {
      setRoles(await stablecoin.getAllRoles());
    } catch { /* ignore */ }
    setLoading(false);
  }, [stablecoin]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!stablecoin) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300">Role Assignments</h3>
        <button onClick={refresh} className="text-xs text-slate-500 hover:text-slate-300">Refresh</button>
      </div>
      {loading ? (
        <p className="text-xs text-slate-500">Loading...</p>
      ) : roles.length === 0 ? (
        <p className="text-xs text-slate-500">No roles assigned</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-500">
                <th className="pb-2 pr-4 font-medium">Address</th>
                <th className="pb-2 pr-4 font-medium">Role</th>
                <th className="pb-2 font-medium">Assigned By</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.publicKey.toBase58()} className="border-b border-slate-800">
                  <td className="py-2 pr-4 font-mono text-slate-300">{shortAddr(r.address.toBase58())}</td>
                  <td className="py-2 pr-4 capitalize text-slate-300">
                    {ROLE_TYPE_NAMES[r.roleType] ?? `Unknown(${r.roleType})`}
                  </td>
                  <td className="py-2 font-mono text-slate-500">{shortAddr(r.assignedBy.toBase58())}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
