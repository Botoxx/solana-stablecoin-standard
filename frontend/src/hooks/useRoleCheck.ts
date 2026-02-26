import { useEffect, useState } from "react";
import { useStablecoinContext } from "../context/StablecoinContext";
import type { RoleTypeValue } from "../lib/constants";
import { ROLE_TYPE_NAMES } from "../lib/constants";

/** Returns { hasRole, roleName } — null while loading or on error. */
export function useRoleCheck(role: RoleTypeValue) {
  const { stablecoin } = useStablecoinContext();
  const [hasRole, setHasRole] = useState<boolean | null>(null);

  useEffect(() => {
    setHasRole(null);
    if (!stablecoin) return;
    stablecoin.hasRole(role).then(setHasRole).catch(() => setHasRole(null));
  }, [stablecoin, role]);

  return { hasRole, roleName: ROLE_TYPE_NAMES[role] };
}
