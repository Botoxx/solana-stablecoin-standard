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
    const decimals = state.decimals;
    const rawAmount = new BN(Math.floor(parseFloat(amount) * 10 ** decimals));
    const recipientPk = new PublicKey(recipient);
    await execute("Minting tokens", () => stablecoin.mint(recipientPk, rawAmount));
    setAmount("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-300">Mint Tokens</h3>
      <AddressInput
        label="Recipient Token Account"
        value={recipient}
        onChange={setRecipient}
      />
      <AmountInput label="Amount" value={amount} onChange={setAmount} />
      <button
        type="submit"
        disabled={!stablecoin || !amount || !recipient}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        Mint
      </button>
    </form>
  );
};
