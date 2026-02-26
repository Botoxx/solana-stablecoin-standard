import { FC, FormEvent, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useStablecoinContext } from "../../context/StablecoinContext";
import { useTransactionToast } from "../../hooks/useTransactionToast";
import { useRoleCheck } from "../../hooks/useRoleCheck";
import { AddressInput } from "../shared/AddressInput";
import { AmountInput } from "../shared/AmountInput";
import { RoleBanner } from "../shared/RoleBanner";
import { RoleType } from "../../lib/constants";
import { parseTokenAmount } from "../../lib/stablecoin";

export const MintForm: FC = () => {
  const { stablecoin, state } = useStablecoinContext();
  const { execute } = useTransactionToast();
  const { hasRole, roleName } = useRoleCheck(RoleType.Minter);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stablecoin || !state) return;
    const rawAmount = parseTokenAmount(amount, state.decimals);
    await execute("Minting tokens", () => stablecoin.mint(new PublicKey(recipient), rawAmount));
    setAmount("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
        <h3 className="text-sm font-semibold text-slate-200">Mint</h3>
      </div>
      {hasRole === false && <RoleBanner roleName={roleName} />}
      <AddressInput label="Recipient Wallet Address" value={recipient} onChange={setRecipient} />
      <AmountInput label="Amount" value={amount} onChange={setAmount} />
      <button type="submit" disabled={!stablecoin || !amount || !recipient} className="btn btn-primary w-full">
        Mint Tokens
      </button>
    </form>
  );
};
