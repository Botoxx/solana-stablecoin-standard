import { FC, FormEvent, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useStablecoinContext } from "../../context/StablecoinContext";
import { useTransactionToast } from "../../hooks/useTransactionToast";
import { AddressInput } from "../shared/AddressInput";
import { RoleType, ROLE_TYPE_NAMES } from "../../lib/constants";
import type { RoleTypeValue } from "../../lib/constants";

const ROLES = Object.entries(RoleType) as [string, RoleTypeValue][];

export const RoleManager: FC = () => {
  const { stablecoin } = useStablecoinContext();
  const { execute } = useTransactionToast();
  const [address, setAddress] = useState("");
  const [role, setRole] = useState<RoleTypeValue>(RoleType.Minter);

  const handleAssign = async (e: FormEvent) => {
    e.preventDefault();
    if (!stablecoin || !address) return;
    await execute(`Assigning ${ROLE_TYPE_NAMES[role]}`, () =>
      stablecoin.addRole(new PublicKey(address), role),
    );
  };

  const handleRevoke = async () => {
    if (!stablecoin || !address) return;
    await execute(`Revoking ${ROLE_TYPE_NAMES[role]}`, () =>
      stablecoin.removeRole(new PublicKey(address), role),
    );
  };

  return (
    <form onSubmit={handleAssign} className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-300">Manage Roles</h3>
      <AddressInput label="Address" value={address} onChange={setAddress} />
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(Number(e.target.value) as RoleTypeValue)}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
        >
          {ROLES.map(([name, val]) => (
            <option key={val} value={val}>{name}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!stablecoin || !address}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          Assign
        </button>
        <button
          type="button"
          onClick={handleRevoke}
          disabled={!stablecoin || !address}
          className="rounded-lg border border-rose-600/50 px-4 py-2 text-sm font-medium text-rose-400 hover:bg-rose-500/10 disabled:opacity-50"
        >
          Revoke
        </button>
      </div>
    </form>
  );
};
