"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getViewProperty, VIEW_PROPERTIES } from "@/lib/admin-properties";

// Property catalog for the admin workspace: the static catalog plus any fields
// added from the portal (fetched from the sync schema map), so new fields show
// up in views, filters, and sorts without a deploy.
const PropertiesContext = createContext({
  properties: VIEW_PROPERTIES,
  getProperty: (key) => getViewProperty(key),
  dynamicProperties: [],
  refresh: () => {}
});

export function PropertiesProvider({ children }) {
  const [dynamicProperties, setDynamicProperties] = useState([]);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/schema");
      const body = await response.json();

      if (response.ok) {
        const staticKeys = new Set(VIEW_PROPERTIES.map((property) => property.key));

        setDynamicProperties((body.fields || []).filter((field) => !staticKeys.has(field.key)));
      }
    } catch {
      // The static catalog still works without the dynamic list.
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(() => {
    const properties = [...VIEW_PROPERTIES, ...dynamicProperties];
    const map = new Map(properties.map((property) => [property.key, property]));

    return {
      properties,
      dynamicProperties,
      getProperty: (key) => map.get(key) || null,
      refresh
    };
  }, [dynamicProperties, refresh]);

  return <PropertiesContext.Provider value={value}>{children}</PropertiesContext.Provider>;
}

export function useProperties() {
  return useContext(PropertiesContext);
}
