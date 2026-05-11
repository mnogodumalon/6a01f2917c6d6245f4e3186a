import type { Fehlerbehebung, Fehlerberichte } from './app';

export type EnrichedFehlerberichte = Fehlerberichte & {
  betroffene_geraeteName: string;
  betroffene_ios_versionName: string;
};

export type EnrichedFehlerbehebung = Fehlerbehebung & {
  behoben_in_versionName: string;
  fehler_referenzName: string;
};
