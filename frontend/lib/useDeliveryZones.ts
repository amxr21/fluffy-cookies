"use client";

import { useEffect, useState } from "react";
import { dashboardGet, decimalToMinor } from "@/lib/dashboard";

export type DeliveryZone = { id: string; name: string; fee: string; freeDeliveryThreshold: string | null };

export function useDeliveryZones() {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ revision: number; zones: DeliveryZone[]; error: string | null } | null>(null);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [config, zones] = await Promise.all([dashboardGet<{ currency: string }>("/config"), dashboardGet<DeliveryZone[]>("/delivery-zones")]);
        if (!config.ok) throw new Error(config.error.message);
        if (config.data.currency !== "AED") throw new Error("Store pricing is unavailable. Please contact us.");
        if (!zones.ok) throw new Error(zones.error.message);
        if (!Array.isArray(zones.data)) throw new Error("Invalid delivery areas");
        for (const zone of zones.data) {
          if (typeof zone.id !== "string" || !zone.id || typeof zone.name !== "string" || !zone.name) throw new Error("Invalid delivery area");
          decimalToMinor(zone.fee);
          if (zone.freeDeliveryThreshold !== null) decimalToMinor(zone.freeDeliveryThreshold);
        }
        if (active) setResult({ revision, zones: zones.data, error: null });
      } catch (error) {
        if (active) setResult({ revision, zones: [], error: error instanceof Error ? error.message : "Couldn't load delivery areas. Please try again." });
      }
    })();
    return () => { active = false; };
  }, [revision]);
  const current = result?.revision === revision ? result : null;
  return { zones: current?.zones ?? [], error: current?.error ?? null, loading: current === null, refresh: () => setRevision(value => value + 1) };
}
