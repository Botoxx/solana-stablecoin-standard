import { FC } from "react";
import { useToast } from "../../context/ToastContext";

function explorerUrl(signature: string, network: string): string {
  const cluster = network === "mainnet-beta" ? "" : `?cluster=${network}`;
  return `https://explorer.solana.com/tx/${signature}${cluster}`;
}

export const TransactionLink: FC<{ signature: string; label?: string }> = ({
  signature,
  label,
}) => {
  const { network } = useToast();
  return (
    <a
      href={explorerUrl(signature, network)}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sky-400 hover:text-sky-300 text-xs underline underline-offset-2"
    >
      {label ?? `${signature.slice(0, 8)}...`}
    </a>
  );
};
