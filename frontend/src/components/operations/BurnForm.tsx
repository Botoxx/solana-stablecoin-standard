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

export const BurnForm: FC = () => {
  const { stablecoin, state } = useStablecoinContext();
  const { execute } = useTransactionToast();
  const { hasRole, roleName } = useRoleCheck(RoleType.Burner);
  const [tokenAccount, setTokenAccount] = useState("");
  const [amount, setAmount] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stablecoin || !state) return;
    const rawAmount = parseTokenAmount(amount, state.decimals);
    const account = tokenAccount ? new PublicKey(tokenAccount) : undefined;
    await execute("Burning tokens", () => stablecoin.burn(rawAmount, account));
    setAmount("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-[var(--color-danger)]" />
        <h3 className="text-sm font-semibold text-slate-200">Burn</h3>
      </div>
      {hasRole === false && <RoleBanner roleName={roleName} />}
      <AddressInput label="Source Wallet (leave empty for yours)" value={tokenAccount} onChange={setTokenAccount} placeholder="Leave empty for your wallet" />
      <AmountInput label="Amount" value={amount} onChange={setAmount} />
      <button type="submit" disabled={!stablecoin || !amount} className="btn btn-danger w-full">
        Burn Tokens
      </button>
    </form>
  );
};
