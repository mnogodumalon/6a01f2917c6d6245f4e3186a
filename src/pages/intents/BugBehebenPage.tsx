import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { StatusBadge } from '@/components/StatusBadge';
import { FehlerberichteDialog } from '@/components/dialogs/FehlerberichteDialog';
import { FehlerbehebungDialog } from '@/components/dialogs/FehlerbehebungDialog';
import { LivingAppsService } from '@/services/livingAppsService';
import { createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import type { Fehlerberichte, IosVersionen, Geraete } from '@/types/app';
import type { EnrichedFehlerberichte, EnrichedFehlerbehebung } from '@/types/enriched';
import { enrichFehlerberichte, enrichFehlerbehebung } from '@/lib/enrich';
import { format, parseISO } from 'date-fns';
import { IconBug, IconCheck, IconCircleCheck, IconAlertTriangle, IconPlus } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';

const WIZARD_STEPS = [
  { label: 'Fehlerbericht' },
  { label: 'Behebung' },
  { label: 'Abschluss' },
  { label: 'Fertig' },
];

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '–';
  try {
    return format(parseISO(dateStr), 'dd.MM.yyyy');
  } catch {
    return dateStr;
  }
}

export default function BugBehebenPage() {
  const [searchParams] = useSearchParams();

  // Data state
  const [fehlerberichte, setFehlerberichte] = useState<Fehlerberichte[]>([]);
  const [iosVersionen, setIosVersionen] = useState<IosVersionen[]>([]);
  const [geraete, setGeraete] = useState<Geraete[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedFehlerberichtId, setSelectedFehlerberichtId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [createdFix, setCreatedFix] = useState<EnrichedFehlerbehebung | null>(null);
  const [resolving, setResolving] = useState(false);

  // Dialog state
  const [fehlerberichteDialogOpen, setFehlerberichteDialogOpen] = useState(false);
  const [fehlerbehebungDialogOpen, setFehlerbehebungDialogOpen] = useState(false);

  // Deep-linking: read fehlerberichtId from URL on mount
  useEffect(() => {
    const fehlerberichtId = searchParams.get('fehlerberichtId');
    if (fehlerberichtId) {
      setSelectedFehlerberichtId(fehlerberichtId);
      setCurrentStep(2);
    } else {
      const urlStep = parseInt(searchParams.get('step') ?? '', 10);
      if (urlStep >= 1 && urlStep <= WIZARD_STEPS.length) {
        setCurrentStep(urlStep);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchFehlerberichte = useCallback(async () => {
    const data = await LivingAppsService.getFehlerberichte();
    setFehlerberichte(data);
  }, []);

  const fetchAll = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [fb, ios, ger] = await Promise.all([
        LivingAppsService.getFehlerberichte(),
        LivingAppsService.getIosVersionen(),
        LivingAppsService.getGeraete(),
      ]);
      setFehlerberichte(fb);
      setIosVersionen(ios);
      setGeraete(ger);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-open fix dialog when arriving at step 2
  useEffect(() => {
    if (currentStep === 2 && selectedFehlerberichtId && !createdFix) {
      setFehlerbehebungDialogOpen(true);
    }
  }, [currentStep, selectedFehlerberichtId, createdFix]);

  // Derived: enriched fehlerberichte
  const iosVersionenMap = new Map(iosVersionen.map(v => [v.record_id, v]));
  const geraeteMap = new Map(geraete.map(g => [g.record_id, g]));
  const fehlerberichteMap = new Map(fehlerberichte.map(f => [f.record_id, f]));

  const enrichedFehlerberichte: EnrichedFehlerberichte[] = enrichFehlerberichte(fehlerberichte, {
    geraeteMap,
    iosVersionenMap,
  });

  const filteredFehlerberichte = showAll
    ? enrichedFehlerberichte
    : enrichedFehlerberichte.filter(f => {
        const key = f.fields.status?.key ?? '';
        return key !== 'behoben' && key !== 'geschlossen';
      });

  const openCount = enrichedFehlerberichte.filter(f => {
    const key = f.fields.status?.key ?? '';
    return key !== 'behoben' && key !== 'geschlossen';
  }).length;

  const selectedFehlerberichtRecord = selectedFehlerberichtId
    ? enrichedFehlerberichte.find(f => f.record_id === selectedFehlerberichtId) ?? null
    : null;

  // Enrich createdFix for display
  const enrichedCreatedFix: EnrichedFehlerbehebung | null = createdFix
    ? enrichFehlerbehebung([createdFix], { iosVersionenMap, fehlerberichteMap })[0]
    : null;

  function handleSelectFehlerbericht(id: string) {
    setSelectedFehlerberichtId(id);
    setCreatedFix(null);
    setCurrentStep(2);
  }

  function handleReset() {
    setSelectedFehlerberichtId(null);
    setCreatedFix(null);
    setCurrentStep(1);
    setShowAll(false);
  }

  async function handleMarkAsFixed() {
    if (!selectedFehlerberichtId) return;
    setResolving(true);
    try {
      await LivingAppsService.updateFehlerberichteEntry(selectedFehlerberichtId, { status: 'behoben' });
      await fetchFehlerberichte();
      setCurrentStep(4);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler beim Aktualisieren des Status');
    } finally {
      setResolving(false);
    }
  }

  // Determine fix version label for display
  function getFixVersionLabel(): string {
    if (!createdFix?.fields.behoben_in_version) return '–';
    const id = extractRecordId(createdFix.fields.behoben_in_version);
    if (!id) return '–';
    const v = iosVersionenMap.get(id);
    return v?.fields.versionsnummer ?? '–';
  }

  return (
    <IntentWizardShell
      title="Bug beheben"
      subtitle="Führe dich durch den vollständigen Bug-Behebungsprozess"
      steps={WIZARD_STEPS}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* STEP 1: Fehlerbericht auswählen */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-semibold">Welchen Fehler beheben?</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Wähle einen offenen Fehlerbericht aus, um mit der Behebung zu beginnen.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                <IconAlertTriangle size={13} stroke={2} />
                {openCount} offene {openCount === 1 ? 'Fehler' : 'Fehler'}
              </span>
              <button
                type="button"
                onClick={() => setShowAll(v => !v)}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              >
                {showAll ? 'Nur offene anzeigen' : 'Alle anzeigen'}
              </button>
            </div>
          </div>

          <EntitySelectStep
            items={filteredFehlerberichte.map(f => ({
              id: f.record_id,
              title: f.fields.fehler_titel ?? '(Kein Titel)',
              subtitle: f.fields.fehler_beschreibung ?? undefined,
              status: f.fields.schweregrad
                ? { key: f.fields.schweregrad.key, label: f.fields.schweregrad.label }
                : undefined,
              icon: <IconBug size={18} className="text-primary" stroke={1.5} />,
              stats: [
                ...(f.fields.meldedatum ? [{ label: 'Gemeldet', value: formatDate(f.fields.meldedatum) }] : []),
                ...(f.betroffene_ios_versionName ? [{ label: 'iOS', value: f.betroffene_ios_versionName }] : []),
                ...(f.betroffene_geraeteName ? [{ label: 'Gerät', value: f.betroffene_geraeteName }] : []),
                ...(f.fields.status ? [{ label: 'Status', value: f.fields.status.label }] : []),
              ],
            }))}
            onSelect={handleSelectFehlerbericht}
            searchPlaceholder="Fehlerbericht suchen..."
            emptyIcon={<IconBug size={40} stroke={1} />}
            emptyText={showAll ? 'Keine Fehlerberichte vorhanden.' : 'Keine offenen Fehler gefunden.'}
            createLabel="Neuer Fehlerbericht"
            onCreateNew={() => setFehlerberichteDialogOpen(true)}
            createDialog={
              <FehlerberichteDialog
                open={fehlerberichteDialogOpen}
                onClose={() => setFehlerberichteDialogOpen(false)}
                onSubmit={async (fields) => {
                  await LivingAppsService.createFehlerberichteEntry(fields);
                  await fetchAll();
                }}
                geraeteList={geraete}
                ios_versionenList={iosVersionen}
              />
            }
          />
        </div>
      )}

      {/* STEP 2: Fix dokumentieren */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Behebung dokumentieren</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Dokumentiere, wie der Fehler behoben wurde.
            </p>
          </div>

          {/* Bug summary card */}
          {selectedFehlerberichtRecord && (
            <div className="rounded-xl border bg-card overflow-hidden p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                  <IconBug size={20} className="text-destructive" stroke={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate">
                      {selectedFehlerberichtRecord.fields.fehler_titel ?? '(Kein Titel)'}
                    </span>
                    {selectedFehlerberichtRecord.fields.schweregrad && (
                      <StatusBadge statusKey={selectedFehlerberichtRecord.fields.schweregrad.key} label={selectedFehlerberichtRecord.fields.schweregrad.label} />
                    )}
                  </div>
                  {selectedFehlerberichtRecord.fields.fehler_beschreibung && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {selectedFehlerberichtRecord.fields.fehler_beschreibung}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1 border-t">
                {selectedFehlerberichtRecord.betroffene_geraeteName && (
                  <div>
                    <p className="text-xs text-muted-foreground">Betroffenes Gerät</p>
                    <p className="text-sm font-medium truncate">{selectedFehlerberichtRecord.betroffene_geraeteName}</p>
                  </div>
                )}
                {selectedFehlerberichtRecord.betroffene_ios_versionName && (
                  <div>
                    <p className="text-xs text-muted-foreground">Betroffene iOS Version</p>
                    <p className="text-sm font-medium truncate">{selectedFehlerberichtRecord.betroffene_ios_versionName}</p>
                  </div>
                )}
                {selectedFehlerberichtRecord.fields.meldedatum && (
                  <div>
                    <p className="text-xs text-muted-foreground">Gemeldet am</p>
                    <p className="text-sm font-medium">{formatDate(selectedFehlerberichtRecord.fields.meldedatum)}</p>
                  </div>
                )}
                {selectedFehlerberichtRecord.fields.status && (
                  <div>
                    <p className="text-xs text-muted-foreground">Aktueller Status</p>
                    <p className="text-sm font-medium">{selectedFehlerberichtRecord.fields.status.label}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* If fix already created, show summary */}
          {createdFix ? (
            <div className="rounded-xl border bg-green-50 border-green-200 overflow-hidden p-4 space-y-3">
              <div className="flex items-center gap-2">
                <IconCircleCheck size={20} className="text-green-600 shrink-0" stroke={2} />
                <span className="font-semibold text-sm text-green-800">Behebung dokumentiert</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(createdFix.fields.entwickler_vorname || createdFix.fields.entwickler_nachname) && (
                  <div>
                    <p className="text-xs text-muted-foreground">Entwickler</p>
                    <p className="text-sm font-medium truncate">
                      {[createdFix.fields.entwickler_vorname, createdFix.fields.entwickler_nachname].filter(Boolean).join(' ')}
                    </p>
                  </div>
                )}
                {createdFix.fields.fix_beschreibung && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">Fix-Beschreibung</p>
                    <p className="text-sm font-medium line-clamp-2">{createdFix.fields.fix_beschreibung}</p>
                  </div>
                )}
                {createdFix.fields.behebungsdatum && (
                  <div>
                    <p className="text-xs text-muted-foreground">Behebungsdatum</p>
                    <p className="text-sm font-medium">{formatDate(createdFix.fields.behebungsdatum)}</p>
                  </div>
                )}
                {getFixVersionLabel() !== '–' && (
                  <div>
                    <p className="text-xs text-muted-foreground">Behoben in Version</p>
                    <p className="text-sm font-medium">{getFixVersionLabel()}</p>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFehlerbehebungDialogOpen(true)}
                className="w-full sm:w-auto"
              >
                Behebung bearbeiten
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed bg-muted/30 overflow-hidden p-6 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <IconCheck size={22} className="text-primary" stroke={2} />
              </div>
              <div>
                <p className="font-medium text-sm">Behebung noch nicht dokumentiert</p>
                <p className="text-xs text-muted-foreground mt-0.5">Öffne den Dialog, um die Behebung zu erfassen.</p>
              </div>
              <Button onClick={() => setFehlerbehebungDialogOpen(true)} className="gap-2">
                <IconPlus size={16} stroke={2} />
                Behebung dokumentieren
              </Button>
            </div>
          )}

          <FehlerbehebungDialog
            open={fehlerbehebungDialogOpen}
            onClose={() => setFehlerbehebungDialogOpen(false)}
            onSubmit={async (fields) => {
              await LivingAppsService.createFehlerbehebungEntry(fields);
              const enriched: EnrichedFehlerbehebung = {
                record_id: '',
                createdat: new Date().toISOString(),
                updatedat: null,
                fields,
                behoben_in_versionName: '',
                fehler_referenzName: selectedFehlerberichtRecord?.fields.fehler_titel ?? '',
              };
              setCreatedFix(enriched);
              setFehlerbehebungDialogOpen(false);
              setCurrentStep(3);
            }}
            defaultValues={selectedFehlerberichtId ? {
              fehler_referenz: createRecordUrl(APP_IDS.FEHLERBERICHTE, selectedFehlerberichtId),
            } : undefined}
            fehlerberichteList={fehlerberichte}
            ios_versionenList={iosVersionen}
          />

          <div className="flex gap-2 pt-2 flex-wrap">
            <Button variant="outline" onClick={() => setCurrentStep(1)}>
              Zurück
            </Button>
            {createdFix && (
              <Button onClick={() => setCurrentStep(3)} className="gap-2">
                <IconCheck size={16} stroke={2} />
                Weiter zur Bestätigung
              </Button>
            )}
          </div>
        </div>
      )}

      {/* STEP 3: Version verknüpfen & abschließen */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Fix-Version bestätigen</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Überprüfe die Behebungsdetails und markiere den Fehler als behoben.
            </p>
          </div>

          {/* Summary of the fix */}
          {createdFix && (
            <div className="rounded-xl border bg-card overflow-hidden p-4 space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Zusammenfassung der Behebung</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {selectedFehlerberichtRecord && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">Fehler</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p className="text-sm font-medium truncate">
                        {selectedFehlerberichtRecord.fields.fehler_titel ?? '(Kein Titel)'}
                      </p>
                      {selectedFehlerberichtRecord.fields.schweregrad && (
                        <StatusBadge
                          statusKey={selectedFehlerberichtRecord.fields.schweregrad.key}
                          label={selectedFehlerberichtRecord.fields.schweregrad.label}
                        />
                      )}
                    </div>
                  </div>
                )}
                {(createdFix.fields.entwickler_vorname || createdFix.fields.entwickler_nachname) && (
                  <div>
                    <p className="text-xs text-muted-foreground">Entwickler</p>
                    <p className="text-sm font-medium">
                      {[createdFix.fields.entwickler_vorname, createdFix.fields.entwickler_nachname].filter(Boolean).join(' ')}
                    </p>
                  </div>
                )}
                {createdFix.fields.behebungsdatum && (
                  <div>
                    <p className="text-xs text-muted-foreground">Behebungsdatum</p>
                    <p className="text-sm font-medium">{formatDate(createdFix.fields.behebungsdatum)}</p>
                  </div>
                )}
                {getFixVersionLabel() !== '–' && (
                  <div>
                    <p className="text-xs text-muted-foreground">Behoben in Version</p>
                    <p className="text-sm font-medium">{getFixVersionLabel()}</p>
                  </div>
                )}
                {enrichedCreatedFix?.behoben_in_versionName && enrichedCreatedFix.behoben_in_versionName !== getFixVersionLabel() && (
                  <div>
                    <p className="text-xs text-muted-foreground">Version (aufgelöst)</p>
                    <p className="text-sm font-medium">{enrichedCreatedFix.behoben_in_versionName}</p>
                  </div>
                )}
                {createdFix.fields.fix_beschreibung && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">Fix-Beschreibung</p>
                    <p className="text-sm font-medium line-clamp-3">{createdFix.fields.fix_beschreibung}</p>
                  </div>
                )}
                {createdFix.fields.behebung_notizen && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">Notizen</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{createdFix.fields.behebung_notizen}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden p-4 flex items-start gap-3">
            <IconAlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" stroke={2} />
            <div>
              <p className="text-sm font-medium text-amber-800">Status wird auf "Behoben" gesetzt</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Der Fehlerbericht wird als behoben markiert. Diese Aktion kann rückgängig gemacht werden, indem du den Status im Fehlerbericht manuell änderst.
              </p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setCurrentStep(2)}>
              Zurück
            </Button>
            <Button
              onClick={handleMarkAsFixed}
              disabled={resolving || !selectedFehlerberichtId}
              className="gap-2"
            >
              {resolving ? (
                <>Wird gespeichert...</>
              ) : (
                <>
                  <IconCircleCheck size={16} stroke={2} />
                  Als behoben markieren
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: Abschluss */}
      {currentStep === 4 && (
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center py-6 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center">
              <IconCircleCheck size={36} className="text-green-600" stroke={1.5} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Fehler erfolgreich behoben!</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                Der Fehler wurde erfolgreich behoben und als "Behoben" markiert.
              </p>
            </div>
          </div>

          {/* Final summary card */}
          {(selectedFehlerberichtRecord || createdFix) && (
            <div className="rounded-xl border bg-card overflow-hidden p-4 space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Abschlussbericht</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {selectedFehlerberichtRecord && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">Behobener Fehler</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p className="text-sm font-semibold truncate">
                        {selectedFehlerberichtRecord.fields.fehler_titel ?? '(Kein Titel)'}
                      </p>
                      {selectedFehlerberichtRecord.fields.schweregrad && (
                        <StatusBadge
                          statusKey={selectedFehlerberichtRecord.fields.schweregrad.key}
                          label={selectedFehlerberichtRecord.fields.schweregrad.label}
                        />
                      )}
                    </div>
                  </div>
                )}
                {createdFix && (createdFix.fields.entwickler_vorname || createdFix.fields.entwickler_nachname) && (
                  <div>
                    <p className="text-xs text-muted-foreground">Entwickler</p>
                    <p className="text-sm font-medium">
                      {[createdFix.fields.entwickler_vorname, createdFix.fields.entwickler_nachname].filter(Boolean).join(' ')}
                    </p>
                  </div>
                )}
                {createdFix?.fields.behebungsdatum && (
                  <div>
                    <p className="text-xs text-muted-foreground">Behebungsdatum</p>
                    <p className="text-sm font-medium">{formatDate(createdFix.fields.behebungsdatum)}</p>
                  </div>
                )}
                {getFixVersionLabel() !== '–' && (
                  <div>
                    <p className="text-xs text-muted-foreground">Behoben in Version</p>
                    <p className="text-sm font-medium">{getFixVersionLabel()}</p>
                  </div>
                )}
                {createdFix?.fields.fix_beschreibung && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">Fix-Beschreibung</p>
                    <p className="text-sm font-medium line-clamp-3">{createdFix.fields.fix_beschreibung}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-3 flex-wrap justify-center">
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <IconBug size={16} stroke={1.5} />
              Weiteren Fehler beheben
            </Button>
            <a href="#/fehlerbehebung">
              <Button className="gap-2">
                <IconCheck size={16} stroke={2} />
                Fehlerbehebungen ansehen
              </Button>
            </a>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
