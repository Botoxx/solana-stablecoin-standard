import { FC, FormEvent, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { useStablecoinContext } from "../../context/StablecoinContext";
import { useTransactionToast } from "../../hooks/useTransactionToast";
import { AddressInput } from "../shared/AddressInput";
import { AmountInput } from "../shared/AmountInput";

export const MintForm: FC = () => {
  const { stablecoin, state } = useStablecoinContext();
  const { execute } = useTransactionToast();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stablecoin || !state) return;
    const rawAmount = new BN(Math.floor(parseFloat(amount) * 10 ** state.decimals));
    await execute("Minting tokens", () => stablecoin.mint(new PublicKey(recipient), rawAmount));
    setAmount("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
        <h3 className="text-sm font-semibold text-slate-200">Mint</h3>
      </div>
      <AddressInput label="Recipient Token Account" value={recipient} onChange={setRecipient} />
      <AmountInput label="Amount" value={amount} onChange={setAmount} />
      <button type="submit" disabled={!stablecoin || !amount || !recipient} className="btn btn-primary w-full">
        Mint Tokens
      </button>
    </form>
  );
};
