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
      className="inline-flex items-center gap-1 text-[var(--color-info)] hover:text-sky-300 text-xs transition-colors"
    >
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
      {label ?? `${signature.slice(0, 8)}...`}
    </a>
  );
};
