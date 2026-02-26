import { useCallback } from "react";
import { useToast } from "../context/ToastContext";
import { parseAnchorError } from "../context/StablecoinContext";
import { useStablecoinContext } from "../context/StablecoinContext";

export function useTransactionToast() {
  const { addToast, updateToast } = useToast();
  const { refreshState } = useStablecoinContext();

  const execute = useCallback(
    async (label: string, fn: () => Promise<string>) => {
      const tid = addToast("loading", `${label}...`);
      try {
        const sig = await fn();
        updateToast(tid, { type: "success", message: label, signature: sig });
        await refreshState();
        return sig;
      } catch (err) {
        updateToast(tid, { type: "error", message: parseAnchorError(err) });
        return null;
      }
    },
    [addToast, updateToast, refreshState],
  );

  return { execute };
}
