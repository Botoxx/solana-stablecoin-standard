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
      <p className="section-title">Assign / Revoke Roles</p>
      <AddressInput label="Address" value={address} onChange={setAddress} />
      <div>
        <label className="label">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(Number(e.target.value) as RoleTypeValue)}
          className="input"
        >
          {ROLES.map(([name, val]) => (
            <option key={val} value={val}>{name}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={!stablecoin || !address} className="btn btn-primary flex-1">
          Assign
        </button>
        <button type="button" onClick={handleRevoke} disabled={!stablecoin || !address} className="btn btn-outline-danger flex-1">
          Revoke
        </button>
      </div>
    </form>
  );
};
