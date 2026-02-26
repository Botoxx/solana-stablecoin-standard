import { FC } from "react";
import { useStablecoinContext } from "../context/StablecoinContext";
import { MintForm } from "../components/operations/MintForm";
import { BurnForm } from "../components/operations/BurnForm";
import { FreezeThawPanel } from "../components/operations/FreezeThawPanel";
import { PausePanel } from "../components/operations/PausePanel";
import { EmptyState } from "../components/shared/EmptyState";

export const OperationsPage: FC = () => {
  const { stablecoin } = useStablecoinContext();

  if (!stablecoin) {
    return <EmptyState title="Load or create a stablecoin first" />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Operations</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <MintForm />
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <BurnForm />
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <FreezeThawPanel />
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <PausePanel />
        </div>
      </div>
    </div>
  );
};
