// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export interface IosVersionen {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    versionsnummer?: string;
    veroeffentlichungsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    versionshinweise?: string;
  };
}

export interface Geraete {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    geraet_name?: string;
    geraet_modell?: string;
    geraet_typ?: LookupValue;
    geraet_notizen?: string;
  };
}

export interface Fehlerberichte {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    betroffene_geraete?: string; // applookup -> URL zu 'Geraete' Record
    meldedatum?: string; // Format: YYYY-MM-DD oder ISO String
    melder_vorname?: string;
    melder_nachname?: string;
    melder_email?: string;
    screenshot?: string;
    zusaetzliche_hinweise?: string;
    betroffene_ios_version?: string; // applookup -> URL zu 'IosVersionen' Record
    fehler_titel?: string;
    fehler_beschreibung?: string;
    schritte_reproduzieren?: string;
    schweregrad?: LookupValue;
    status?: LookupValue;
  };
}

export interface Fehlerbehebung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    fix_beschreibung?: string;
    behoben_in_version?: string; // applookup -> URL zu 'IosVersionen' Record
    behebung_notizen?: string;
    fehler_referenz?: string; // applookup -> URL zu 'Fehlerberichte' Record
    entwickler_vorname?: string;
    entwickler_nachname?: string;
    behebungsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    behebungsstatus?: LookupValue;
  };
}

export const APP_IDS = {
  IOS_VERSIONEN: '6a01f2691f0ec566018b68a7',
  GERAETE: '6a01f2712fbe920228001854',
  FEHLERBERICHTE: '6a01f27386a0e488786a9877',
  FEHLERBEHEBUNG: '6a01f275a49057ebfe7b5d5e',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'geraete': {
    geraet_typ: [{ key: "iphone", label: "iPhone" }, { key: "ipad", label: "iPad" }, { key: "ipod_touch", label: "iPod Touch" }, { key: "apple_watch", label: "Apple Watch" }, { key: "apple_tv", label: "Apple TV" }, { key: "mac", label: "Mac" }],
  },
  'fehlerberichte': {
    schweregrad: [{ key: "kritisch", label: "Kritisch" }, { key: "hoch", label: "Hoch" }, { key: "mittel", label: "Mittel" }, { key: "niedrig", label: "Niedrig" }],
    status: [{ key: "offen", label: "Offen" }, { key: "in_bearbeitung", label: "In Bearbeitung" }, { key: "behoben", label: "Behoben" }, { key: "geschlossen", label: "Geschlossen" }, { key: "nicht_reproduzierbar", label: "Nicht reproduzierbar" }],
  },
  'fehlerbehebung': {
    behebungsstatus: [{ key: "in_bearbeitung", label: "In Bearbeitung" }, { key: "behoben", label: "Behoben" }, { key: "nicht_behebbar", label: "Nicht behebbar" }, { key: "duplikat", label: "Als Duplikat markiert" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'ios_versionen': {
    'versionsnummer': 'string/text',
    'veroeffentlichungsdatum': 'date/date',
    'versionshinweise': 'string/textarea',
  },
  'geraete': {
    'geraet_name': 'string/text',
    'geraet_modell': 'string/text',
    'geraet_typ': 'lookup/select',
    'geraet_notizen': 'string/textarea',
  },
  'fehlerberichte': {
    'betroffene_geraete': 'applookup/select',
    'meldedatum': 'date/date',
    'melder_vorname': 'string/text',
    'melder_nachname': 'string/text',
    'melder_email': 'string/email',
    'screenshot': 'file',
    'zusaetzliche_hinweise': 'string/textarea',
    'betroffene_ios_version': 'applookup/select',
    'fehler_titel': 'string/text',
    'fehler_beschreibung': 'string/textarea',
    'schritte_reproduzieren': 'string/textarea',
    'schweregrad': 'lookup/select',
    'status': 'lookup/select',
  },
  'fehlerbehebung': {
    'fix_beschreibung': 'string/textarea',
    'behoben_in_version': 'applookup/select',
    'behebung_notizen': 'string/textarea',
    'fehler_referenz': 'applookup/select',
    'entwickler_vorname': 'string/text',
    'entwickler_nachname': 'string/text',
    'behebungsdatum': 'date/date',
    'behebungsstatus': 'lookup/select',
  },
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateIosVersionen = StripLookup<IosVersionen['fields']>;
export type CreateGeraete = StripLookup<Geraete['fields']>;
export type CreateFehlerberichte = StripLookup<Fehlerberichte['fields']>;
export type CreateFehlerbehebung = StripLookup<Fehlerbehebung['fields']>;