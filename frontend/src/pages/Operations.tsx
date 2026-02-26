import { FC } from "react";
import { useStablecoinContext } from "../context/StablecoinContext";
import { MintForm } from "../components/operations/MintForm";
import { BurnForm } from "../components/operations/BurnForm";
import { FreezeThawPanel } from "../components/operations/FreezeThawPanel";
import { PausePanel } from "../components/operations/PausePanel";
import { EmptyState } from "../components/shared/EmptyState";

export const OperationsPage: FC = () => {
  const { stablecoin } = useStablecoinContext();

  if (!stablecoin) return <EmptyState title="Load or create a stablecoin first" />;

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-semibold text-slate-100">Operations</h1>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 stagger-children">
        <div className="card"><MintForm /></div>
        <div className="card"><BurnForm /></div>
        <div className="card"><FreezeThawPanel /></div>
        <div className="card"><PausePanel /></div>
      </div>
    </div>
  );
};
