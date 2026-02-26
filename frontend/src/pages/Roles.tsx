import { FC } from "react";
import { useStablecoinContext } from "../context/StablecoinContext";
import { RoleManager } from "../components/roles/RoleManager";
import { MinterManager } from "../components/roles/MinterManager";
import { RoleList } from "../components/roles/RoleList";
import { MinterList } from "../components/roles/MinterList";
import { EmptyState } from "../components/shared/EmptyState";

export const RolesPage: FC = () => {
  const { stablecoin } = useStablecoinContext();

  if (!stablecoin) return <EmptyState title="Load or create a stablecoin first" />;

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-semibold text-slate-100">Role & Minter Management</h1>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 stagger-children">
        <div className="card"><RoleManager /></div>
        <div className="card"><MinterManager /></div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card"><RoleList /></div>
        <div className="card"><MinterList /></div>
      </div>
    </div>
  );
};
