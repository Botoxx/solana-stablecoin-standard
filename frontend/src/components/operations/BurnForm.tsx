import { FC, FormEvent, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { useStablecoinContext } from "../../context/StablecoinContext";
import { useTransactionToast } from "../../hooks/useTransactionToast";
import { AddressInput } from "../shared/AddressInput";
import { AmountInput } from "../shared/AmountInput";

export const BurnForm: FC = () => {
  const { stablecoin, state } = useStablecoinContext();
  const { execute } = useTransactionToast();
  const [tokenAccount, setTokenAccount] = useState("");
  const [amount, setAmount] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stablecoin || !state) return;
    const rawAmount = new BN(Math.floor(parseFloat(amount) * 10 ** state.decimals));
    const account = tokenAccount ? new PublicKey(tokenAccount) : undefined;
    await execute("Burning tokens", () => stablecoin.burn(rawAmount, account));
    setAmount("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-300">Burn Tokens</h3>
      <AddressInput
        label="Token Account (leave empty for your ATA)"
        value={tokenAccount}
        onChange={setTokenAccount}
        placeholder="Leave empty for default"
      />
      <AmountInput label="Amount" value={amount} onChange={setAmount} />
      <button
        type="submit"
        disabled={!stablecoin || !amount}
        className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
      >
        Burn
      </button>
    </form>
  );
};
