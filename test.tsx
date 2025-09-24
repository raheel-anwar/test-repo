import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { usePermissionErrors } from "./permissionErrorsStore";

export function PageErrorHandler() {
  const location = useLocation();
  const prevPathRef = useRef<string | null>(null);
  const { clearAll } = usePermissionErrors();

  useEffect(() => {
    const currentPath = location.pathname;

    if (prevPathRef.current && prevPathRef.current !== currentPath) {
      // Clear all queryKey errors when navigating to a new page
      clearAll();
    }

    prevPathRef.current = currentPath;
  }, [location.pathname, clearAll]);

  return null; // does not render anything
}
