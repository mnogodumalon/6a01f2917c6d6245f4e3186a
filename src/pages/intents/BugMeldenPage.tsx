import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { GeraeteDialog } from '@/components/dialogs/GeraeteDialog';
import { IosVersionenDialog } from '@/components/dialogs/IosVersionenDialog';
import { FehlerberichteDialog } from '@/components/dialogs/FehlerberichteDialog';
import { LivingAppsService } from '@/services/livingAppsService';
import { createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import type { Geraete, IosVersionen } from '@/types/app';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { IconDeviceMobile, IconBrandApple, IconAlertTriangle, IconCircleCheck, IconPlus } from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Gerät' },
  { label: 'iOS-Version' },
  { label: 'Details' },
  { label: 'Abschluss' },
];

export default function BugMeldenPage() {
  const [searchParams] = useSearchParams();

  // Determine initial step from URL
  const urlStep = parseInt(searchParams.get('step') ?? '', 10);
  const urlGeraetId = searchParams.get('geraetId') ?? null;

  const initialStep = urlGeraetId ? 2 : (urlStep >= 1 && urlStep <= 4 ? urlStep : 1);

  const [currentStep, setCurrentStep] = useState(initialStep);

  // Data
  const [geraeteList, setGeraeteList] = useState<Geraete[]>([]);
  const [iosVersionenList, setIosVersionenList] = useState<IosVersionen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Selections
  const [selectedGeraetId, setSelectedGeraetId] = useState<string | null>(urlGeraetId);
  const [selectedIosVersionId, setSelectedIosVersionId] = useState<string | null>(null);

  // Submitted bug report info for success screen
  const [submittedTitle, setSubmittedTitle] = useState<string | null>(null);
  const [submittedDate, setSubmittedDate] = useState<string | null>(null);

  // Dialog states
  const [geraeteDialogOpen, setGeraeteDialogOpen] = useState(false);
  const [iosVersionenDialogOpen, setIosVersionenDialogOpen] = useState(false);
  const [fehlerberichteDialogOpen, setFehlerberichteDialogOpen] = useState(false);

  const fetchGeraete = useCallback(async () => {
    try {
      const data = await LivingAppsService.getGeraete();
      setGeraeteList(data);
    } catch {
      // silently ignore refresh errors
    }
  }, []);

  const fetchIosVersionen = useCallback(async () => {
    try {
      const data = await LivingAppsService.getIosVersionen();
      setIosVersionenList(data);
    } catch {
      // silently ignore refresh errors
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [geraeteData, iosVersionenData] = await Promise.all([
        LivingAppsService.getGeraete(),
        LivingAppsService.getIosVersionen(),
      ]);
      setGeraeteList(geraeteData);
      setIosVersionenList(iosVersionenData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Auto-open dialog when arriving at step 3
  useEffect(() => {
    if (currentStep === 3 && selectedGeraetId && selectedIosVersionId) {
      setFehlerberichteDialogOpen(true);
    }
  }, [currentStep, selectedGeraetId, selectedIosVersionId]);

  const handleGeraetSelect = (id: string) => {
    setSelectedGeraetId(id);
    setCurrentStep(2);
  };

  const handleIosVersionSelect = (id: string) => {
    setSelectedIosVersionId(id);
    setCurrentStep(3);
  };

  const handleReset = () => {
    setCurrentStep(1);
    setSelectedGeraetId(null);
    setSelectedIosVersionId(null);
    setSubmittedTitle(null);
    setSubmittedDate(null);
    setFehlerberichteDialogOpen(false);
  };

  const selectedGeraet = geraeteList.find(g => g.record_id === selectedGeraetId) ?? null;
  const selectedIosVersion = iosVersionenList.find(v => v.record_id === selectedIosVersionId) ?? null;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      return format(parseISO(dateStr), 'dd.MM.yyyy');
    } catch {
      return dateStr;
    }
  };

  return (
    <IntentWizardShell
      title="Fehler melden"
      subtitle="Melde einen neuen Bug Schritt für Schritt."
      steps={WIZARD_STEPS}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1: Gerät auswählen */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Welches Gerät ist betroffen?</h2>
            <p className="text-sm text-muted-foreground mt-1">Wähle das Gerät aus, auf dem der Fehler aufgetreten ist.</p>
          </div>
          <EntitySelectStep
            items={geraeteList.map(g => ({
              id: g.record_id,
              title: g.fields.geraet_name ?? '(Kein Name)',
              subtitle: g.fields.geraet_modell,
              status: g.fields.geraet_typ,
              icon: <IconDeviceMobile size={20} className="text-primary" stroke={1.5} />,
            }))}
            onSelect={handleGeraetSelect}
            searchPlaceholder="Gerät suchen..."
            emptyIcon={<IconDeviceMobile size={40} stroke={1.5} />}
            emptyText="Kein Gerät gefunden. Erstelle zuerst ein neues Gerät."
            createLabel="Neues Gerät erstellen"
            onCreateNew={() => setGeraeteDialogOpen(true)}
            createDialog={
              <GeraeteDialog
                open={geraeteDialogOpen}
                onClose={() => setGeraeteDialogOpen(false)}
                onSubmit={async (fields) => {
                  await LivingAppsService.createGeraeteEntry(fields);
                  await fetchGeraete();
                }}
              />
            }
          />
        </div>
      )}

      {/* Step 2: iOS-Version auswählen */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Welche iOS-Version ist betroffen?</h2>
            <p className="text-sm text-muted-foreground mt-1">Wähle die iOS-Version aus, auf der der Fehler aufgetreten ist.</p>
          </div>

          {selectedGeraet && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border overflow-hidden">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <IconDeviceMobile size={18} className="text-primary" stroke={1.5} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Ausgewähltes Gerät</p>
                <p className="text-sm font-medium truncate">{selectedGeraet.fields.geraet_name ?? '(Kein Name)'}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto shrink-0 text-xs text-muted-foreground"
                onClick={() => setCurrentStep(1)}
              >
                Ändern
              </Button>
            </div>
          )}

          <EntitySelectStep
            items={iosVersionenList.map(v => ({
              id: v.record_id,
              title: v.fields.versionsnummer ?? '(Keine Version)',
              subtitle: v.fields.veroeffentlichungsdatum
                ? `Veröffentlicht: ${formatDate(v.fields.veroeffentlichungsdatum)}`
                : undefined,
              icon: <IconBrandApple size={20} className="text-primary" stroke={1.5} />,
            }))}
            onSelect={handleIosVersionSelect}
            searchPlaceholder="iOS-Version suchen..."
            emptyIcon={<IconBrandApple size={40} stroke={1.5} />}
            emptyText="Keine iOS-Version gefunden. Erstelle zuerst eine neue Version."
            createLabel="Neue iOS-Version erstellen"
            onCreateNew={() => setIosVersionenDialogOpen(true)}
            createDialog={
              <IosVersionenDialog
                open={iosVersionenDialogOpen}
                onClose={() => setIosVersionenDialogOpen(false)}
                onSubmit={async (fields) => {
                  await LivingAppsService.createIosVersionenEntry(fields);
                  await fetchIosVersionen();
                }}
              />
            }
          />
        </div>
      )}

      {/* Step 3: Fehlerdetails eingeben */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Fehlerdetails eingeben</h2>
            <p className="text-sm text-muted-foreground mt-1">Beschreibe den Fehler so genau wie möglich.</p>
          </div>

          {/* Summary card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border overflow-hidden">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <IconDeviceMobile size={18} className="text-primary" stroke={1.5} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Gerät</p>
                <p className="text-sm font-medium truncate">{selectedGeraet?.fields.geraet_name ?? '—'}</p>
                {selectedGeraet?.fields.geraet_modell && (
                  <p className="text-xs text-muted-foreground truncate">{selectedGeraet.fields.geraet_modell}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto shrink-0 text-xs text-muted-foreground"
                onClick={() => setCurrentStep(1)}
              >
                Ändern
              </Button>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border overflow-hidden">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <IconBrandApple size={18} className="text-primary" stroke={1.5} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">iOS-Version</p>
                <p className="text-sm font-medium truncate">{selectedIosVersion?.fields.versionsnummer ?? '—'}</p>
                {selectedIosVersion?.fields.veroeffentlichungsdatum && (
                  <p className="text-xs text-muted-foreground truncate">
                    {formatDate(selectedIosVersion.fields.veroeffentlichungsdatum)}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto shrink-0 text-xs text-muted-foreground"
                onClick={() => setCurrentStep(2)}
              >
                Ändern
              </Button>
            </div>
          </div>

          {!fehlerberichteDialogOpen && (
            <div className="flex flex-col items-center justify-center py-8 gap-3 rounded-xl border border-dashed bg-muted/30">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center">
                <IconAlertTriangle size={24} className="text-amber-600" stroke={1.5} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Fehlerbericht noch nicht ausgefüllt</p>
                <p className="text-xs text-muted-foreground mt-1">Klicke auf die Schaltfläche, um den Fehlerbericht auszufüllen.</p>
              </div>
              <Button
                onClick={() => setFehlerberichteDialogOpen(true)}
                className="gap-2"
              >
                <IconPlus size={16} stroke={2} />
                Fehlerbericht erstellen
              </Button>
            </div>
          )}

          <FehlerberichteDialog
            open={fehlerberichteDialogOpen}
            onClose={() => setFehlerberichteDialogOpen(false)}
            onSubmit={async (fields) => {
              await LivingAppsService.createFehlerberichteEntry(fields);
              setSubmittedTitle(typeof fields.fehler_titel === 'string' ? fields.fehler_titel : null);
              setSubmittedDate(typeof fields.meldedatum === 'string' ? fields.meldedatum : new Date().toISOString().slice(0, 10));
              setCurrentStep(4);
            }}
            defaultValues={
              selectedGeraetId && selectedIosVersionId
                ? {
                    betroffene_geraete: createRecordUrl(APP_IDS.GERAETE, selectedGeraetId),
                    betroffene_ios_version: createRecordUrl(APP_IDS.IOS_VERSIONEN, selectedIosVersionId),
                  }
                : undefined
            }
            geraeteList={geraeteList}
            ios_versionenList={iosVersionenList}
          />
        </div>
      )}

      {/* Step 4: Abschluss */}
      {currentStep === 4 && (
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center py-6 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center">
              <IconCircleCheck size={36} className="text-green-600" stroke={1.5} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Fehlerbericht eingereicht!</h2>
              <p className="text-sm text-muted-foreground mt-1">Fehlerbericht wurde erfolgreich eingereicht.</p>
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30">
              <p className="text-sm font-semibold">Zusammenfassung</p>
            </div>
            <div className="divide-y">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <IconDeviceMobile size={16} className="text-primary" stroke={1.5} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Gerät</p>
                  <p className="text-sm font-medium truncate">{selectedGeraet?.fields.geraet_name ?? '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <IconBrandApple size={16} className="text-primary" stroke={1.5} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">iOS-Version</p>
                  <p className="text-sm font-medium truncate">{selectedIosVersion?.fields.versionsnummer ?? '—'}</p>
                </div>
              </div>
              {submittedTitle && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <IconAlertTriangle size={16} className="text-amber-600" stroke={1.5} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Fehler-Titel</p>
                    <p className="text-sm font-medium truncate">{submittedTitle}</p>
                  </div>
                </div>
              )}
              {submittedDate && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 ml-11">
                    <p className="text-xs text-muted-foreground">Meldedatum</p>
                    <p className="text-sm font-medium">{formatDate(submittedDate)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleReset}
            >
              Weiteren Fehler melden
            </Button>
            <Button
              className="flex-1"
              asChild
            >
              <a href="#/fehlerberichte">Alle Fehlerberichte ansehen</a>
            </Button>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
