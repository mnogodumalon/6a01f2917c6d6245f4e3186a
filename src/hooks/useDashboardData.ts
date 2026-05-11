import { useState, useEffect, useMemo, useCallback } from 'react';
import type { IosVersionen, Geraete, Fehlerberichte, Fehlerbehebung } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

export function useDashboardData() {
  const [iosVersionen, setIosVersionen] = useState<IosVersionen[]>([]);
  const [geraete, setGeraete] = useState<Geraete[]>([]);
  const [fehlerberichte, setFehlerberichte] = useState<Fehlerberichte[]>([]);
  const [fehlerbehebung, setFehlerbehebung] = useState<Fehlerbehebung[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [iosVersionenData, geraeteData, fehlerberichteData, fehlerbehebungData] = await Promise.all([
        LivingAppsService.getIosVersionen(),
        LivingAppsService.getGeraete(),
        LivingAppsService.getFehlerberichte(),
        LivingAppsService.getFehlerbehebung(),
      ]);
      setIosVersionen(iosVersionenData);
      setGeraete(geraeteData);
      setFehlerberichte(fehlerberichteData);
      setFehlerbehebung(fehlerbehebungData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    async function silentRefresh() {
      try {
        const [iosVersionenData, geraeteData, fehlerberichteData, fehlerbehebungData] = await Promise.all([
          LivingAppsService.getIosVersionen(),
          LivingAppsService.getGeraete(),
          LivingAppsService.getFehlerberichte(),
          LivingAppsService.getFehlerbehebung(),
        ]);
        setIosVersionen(iosVersionenData);
        setGeraete(geraeteData);
        setFehlerberichte(fehlerberichteData);
        setFehlerbehebung(fehlerbehebungData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  const iosVersionenMap = useMemo(() => {
    const m = new Map<string, IosVersionen>();
    iosVersionen.forEach(r => m.set(r.record_id, r));
    return m;
  }, [iosVersionen]);

  const geraeteMap = useMemo(() => {
    const m = new Map<string, Geraete>();
    geraete.forEach(r => m.set(r.record_id, r));
    return m;
  }, [geraete]);

  const fehlerberichteMap = useMemo(() => {
    const m = new Map<string, Fehlerberichte>();
    fehlerberichte.forEach(r => m.set(r.record_id, r));
    return m;
  }, [fehlerberichte]);

  return { iosVersionen, setIosVersionen, geraete, setGeraete, fehlerberichte, setFehlerberichte, fehlerbehebung, setFehlerbehebung, loading, error, fetchAll, iosVersionenMap, geraeteMap, fehlerberichteMap };
}