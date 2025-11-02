import { useEffect, useState } from "react";
import { apiUrl } from "../lib/apiBase";

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}

export function usePermissions(userRole: string | undefined) {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userRole) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      try {
        const response = await fetch(apiUrl("/api/admin/roles"));
        if (response.ok) {
          const data = await response.json();
          const roles: Role[] = data.roles || [];
          const role = roles.find((r) => r.id === userRole);
          setPermissions(role?.permissions || []);
        }
      } catch (error) {
        console.error("[Permissions] Error loading permissions:", error);
        setPermissions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [userRole]);

  const hasPermission = (permission: string): boolean => {
    return permissions.includes(permission);
  };

  const hasAnyPermission = (requiredPermissions: string[]): boolean => {
    return requiredPermissions.some((permission) => permissions.includes(permission));
  };

  const hasAllPermissions = (requiredPermissions: string[]): boolean => {
    return requiredPermissions.every((permission) => permissions.includes(permission));
  };

  return {
    permissions,
    loading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  };
}
