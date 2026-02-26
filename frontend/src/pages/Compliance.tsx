import { FC } from "react";
import { useStablecoinContext } from "../context/StablecoinContext";
import { ComplianceStatus } from "../components/compliance/ComplianceStatus";
import { BlacklistPanel } from "../components/compliance/BlacklistPanel";
import { SeizeFlow } from "../components/compliance/SeizeFlow";
import { EmptyState } from "../components/shared/EmptyState";

export const CompliancePage: FC = () => {
  const { stablecoin } = useStablecoinContext();

  if (!stablecoin) return <EmptyState title="Load or create a stablecoin first" />;

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-semibold text-slate-100">Compliance</h1>
      <ComplianceStatus />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card"><BlacklistPanel /></div>
        <div className="card"><SeizeFlow /></div>
      </div>
    </div>
  );
};
