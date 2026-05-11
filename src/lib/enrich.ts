import type { EnrichedFehlerbehebung, EnrichedFehlerberichte } from '@/types/enriched';
import type { Fehlerbehebung, Fehlerberichte, Geraete, IosVersionen } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface FehlerberichteMaps {
  geraeteMap: Map<string, Geraete>;
  iosVersionenMap: Map<string, IosVersionen>;
}

export function enrichFehlerberichte(
  fehlerberichte: Fehlerberichte[],
  maps: FehlerberichteMaps
): EnrichedFehlerberichte[] {
  return fehlerberichte.map(r => ({
    ...r,
    betroffene_geraeteName: resolveDisplay(r.fields.betroffene_geraete, maps.geraeteMap, 'geraet_name'),
    betroffene_ios_versionName: resolveDisplay(r.fields.betroffene_ios_version, maps.iosVersionenMap, 'versionsnummer'),
  }));
}

interface FehlerbehebungMaps {
  iosVersionenMap: Map<string, IosVersionen>;
  fehlerberichteMap: Map<string, Fehlerberichte>;
}

export function enrichFehlerbehebung(
  fehlerbehebung: Fehlerbehebung[],
  maps: FehlerbehebungMaps
): EnrichedFehlerbehebung[] {
  return fehlerbehebung.map(r => ({
    ...r,
    behoben_in_versionName: resolveDisplay(r.fields.behoben_in_version, maps.iosVersionenMap, 'versionsnummer'),
    fehler_referenzName: resolveDisplay(r.fields.fehler_referenz, maps.fehlerberichteMap, 'fehler_titel'),
  }));
}
