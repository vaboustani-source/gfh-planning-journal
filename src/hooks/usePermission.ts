import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  accessLevel, canView, canEdit, type Access, type Section,
} from "@/lib/permissions";

/** Returns the current user's access level for a specific section. */
export function usePermission(section: Section): Access {
  const { profile } = useAuth();
  return useMemo(() => accessLevel(profile?.role, section), [profile?.role, section]);
}

/** Convenience: bulk helpers bound to the current user. */
export function usePermissions() {
  const { profile } = useAuth();
  const role = profile?.role;
  return useMemo(
    () => ({
      role,
      level: (s: Section) => accessLevel(role, s),
      canView: (s: Section) => canView(role, s),
      canEdit: (s: Section) => canEdit(role, s),
    }),
    [role],
  );
}
