import { FC } from "react";
import { useStablecoinContext } from "../context/StablecoinContext";
import { RoleManager } from "../components/roles/RoleManager";
import { MinterManager } from "../components/roles/MinterManager";
import { RoleList } from "../components/roles/RoleList";
import { MinterList } from "../components/roles/MinterList";
import { EmptyState } from "../components/shared/EmptyState";

export const RolesPage: FC = () => {
  const { stablecoin } = useStablecoinContext();

  if (!stablecoin) {
    return <EmptyState title="Load or create a stablecoin first" />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Role & Minter Management</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <RoleManager />
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <MinterManager />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <RoleList />
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <MinterList />
        </div>
      </div>
    </div>
  );
};
