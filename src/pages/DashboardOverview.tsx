import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichFehlerberichte, enrichFehlerbehebung } from '@/lib/enrich';
import type { EnrichedFehlerberichte, EnrichedFehlerbehebung } from '@/types/enriched';
import type { Fehlerberichte } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { useState, useMemo, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FehlerberichteDialog } from '@/components/dialogs/FehlerberichteDialog';
import { FehlerbehebungDialog } from '@/components/dialogs/FehlerbehebungDialog';
import { AI_PHOTO_SCAN } from '@/config/ai-features';
import {
  IconAlertCircle, IconTool, IconRefresh, IconCheck,
  IconBug, IconBugOff, IconPlus, IconPencil, IconTrash,
  IconAlertTriangle, IconCircleCheck, IconCircleX, IconLoader2,
  IconDeviceMobile, IconVersions, IconTools,
} from '@tabler/icons-react';

const APPGROUP_ID = '6a01f2917c6d6245f4e3186a';
const REPAIR_ENDPOINT = '/claude/build/repair';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  offen: { label: 'Offen', color: 'bg-red-100 text-red-700 border-red-200', icon: <IconAlertCircle size={12} className="shrink-0" /> },
  in_bearbeitung: { label: 'In Bearbeitung', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <IconLoader2 size={12} className="shrink-0" /> },
  behoben: { label: 'Behoben', color: 'bg-green-100 text-green-700 border-green-200', icon: <IconCircleCheck size={12} className="shrink-0" /> },
  geschlossen: { label: 'Geschlossen', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: <IconCircleX size={12} className="shrink-0" /> },
  nicht_reproduzierbar: { label: 'Nicht reproduzierbar', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: <IconBugOff size={12} className="shrink-0" /> },
};

const SCHWEREGRAD_CONFIG: Record<string, { color: string; dot: string }> = {
  kritisch: { color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
  hoch: { color: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  mittel: { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  niedrig: { color: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-400' },
};

const STATUS_ORDER = ['offen', 'in_bearbeitung', 'behoben', 'geschlossen', 'nicht_reproduzierbar'];

export default function DashboardOverview() {
  const {
    iosVersionen, geraete, fehlerberichte, fehlerbehebung,
    iosVersionenMap, geraeteMap, fehlerberichteMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedFehlerberichte = enrichFehlerberichte(fehlerberichte, { geraeteMap, iosVersionenMap });
  const enrichedFehlerbehebung = enrichFehlerbehebung(fehlerbehebung, { iosVersionenMap, fehlerberichteMap });

  const [activeStatus, setActiveStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [schweregradFilter, setSchweregradFilter] = useState<string | null>(null);

  const [fehlerDialog, setFehlerDialog] = useState(false);
  const [editFehler, setEditFehler] = useState<EnrichedFehlerberichte | null>(null);
  const [deleteFehler, setDeleteFehler] = useState<EnrichedFehlerberichte | null>(null);

  const [behebungDialog, setBehebungDialog] = useState(false);
  const [editBehebung, setEditBehebung] = useState<EnrichedFehlerbehebung | null>(null);
  const [prefillFehlerRef, setPrefillFehlerRef] = useState<string | undefined>(undefined);

  const [selectedBug, setSelectedBug] = useState<EnrichedFehlerberichte | null>(null);

  const filteredBugs = useMemo(() => {
    let list = enrichedFehlerberichte;
    if (activeStatus) list = list.filter(b => b.fields.status?.key === activeStatus);
    if (schweregradFilter) list = list.filter(b => b.fields.schweregrad?.key === schweregradFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(b =>
        (b.fields.fehler_titel ?? '').toLowerCase().includes(q) ||
        (b.fields.fehler_beschreibung ?? '').toLowerCase().includes(q) ||
        b.betroffene_geraeteName.toLowerCase().includes(q) ||
        b.betroffene_ios_versionName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [enrichedFehlerberichte, activeStatus, schweregradFilter, searchQuery]);

  const statsByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    for (const b of fehlerberichte) {
      const k = b.fields.status?.key ?? 'offen';
      map[k] = (map[k] ?? 0) + 1;
    }
    return map;
  }, [fehlerberichte]);

  const bugFixes = useCallback((bugId: string) => {
    return enrichedFehlerbehebung.filter(f => {
      const ref = f.fields.fehler_referenz;
      if (!ref) return false;
      const lastSegment = String(ref).split('/').pop();
      return lastSegment === bugId;
    });
  }, [enrichedFehlerbehebung]);

  const handleDeleteFehler = async () => {
    if (!deleteFehler) return;
    await LivingAppsService.deleteFehlerberichteEntry(deleteFehler.record_id);
    if (selectedBug?.record_id === deleteFehler.record_id) setSelectedBug(null);
    setDeleteFehler(null);
    fetchAll();
  };

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  const offeneKritisch = fehlerberichte.filter(b =>
    b.fields.status?.key === 'offen' && b.fields.schweregrad?.key === 'kritisch'
  ).length;

  const selectedBugFixes = selectedBug ? bugFixes(selectedBug.record_id) : [];

  return (
    <div className="space-y-6">
      {/* KPI-Zeile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Fehlerberichte gesamt"
          value={String(fehlerberichte.length)}
          description="Alle gemeldeten Fehler"
          icon={<IconBug size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Offen"
          value={String(statsByStatus['offen'] ?? 0)}
          description={offeneKritisch > 0 ? `${offeneKritisch} kritisch` : 'Keine kritischen'}
          icon={<IconAlertTriangle size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="In Bearbeitung"
          value={String(statsByStatus['in_bearbeitung'] ?? 0)}
          description="Werden bearbeitet"
          icon={<IconLoader2 size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Behoben"
          value={String(statsByStatus['behoben'] ?? 0)}
          description={`${fehlerberichteMap.size > 0 ? Math.round(((statsByStatus['behoben'] ?? 0) / fehlerberichte.length) * 100) : 0}% Lösungsrate`}
          icon={<IconCircleCheck size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Zweispalten-Layout: Liste + Detailansicht */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Linke Spalte: Fehlerberichte-Liste */}
        <div className="xl:col-span-3 space-y-3">
          {/* Filter & Aktionen */}
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex flex-wrap gap-1.5 items-center min-w-0">
              <button
                onClick={() => setActiveStatus(null)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${activeStatus === null ? 'bg-foreground text-background border-foreground' : 'bg-background text-muted-foreground border-border hover:border-foreground'}`}
              >
                Alle ({fehlerberichte.length})
              </button>
              {STATUS_ORDER.map(key => {
                const cfg = STATUS_CONFIG[key];
                const count = statsByStatus[key] ?? 0;
                if (count === 0) return null;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveStatus(activeStatus === key ? null : key)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${activeStatus === key ? 'bg-foreground text-background border-foreground' : 'bg-background text-muted-foreground border-border hover:border-foreground'}`}
                  >
                    {cfg.label} ({count})
                  </button>
                );
              })}
            </div>
            <Button size="sm" onClick={() => { setEditFehler(null); setFehlerDialog(true); }}>
              <IconPlus size={14} className="mr-1 shrink-0" />
              <span className="hidden sm:inline">Neuer Fehler</span>
              <span className="sm:hidden">Neu</span>
            </Button>
          </div>

          {/* Suche + Schweregrad-Filter */}
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              placeholder="Fehler suchen..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 min-w-0 h-8 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <select
              value={schweregradFilter ?? ''}
              onChange={e => setSchweregradFilter(e.target.value || null)}
              className="h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Alle Schweregrade</option>
              {LOOKUP_OPTIONS.fehlerberichte.schweregrad.map(o => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Bugkarten */}
          <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-340px)]">
            {filteredBugs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <IconBugOff size={40} stroke={1.5} className="text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Keine Fehlerberichte gefunden.</p>
              </div>
            ) : (
              filteredBugs.map(bug => {
                const statusCfg = STATUS_CONFIG[bug.fields.status?.key ?? 'offen'];
                const sgCfg = SCHWEREGRAD_CONFIG[bug.fields.schweregrad?.key ?? ''];
                const fixes = bugFixes(bug.record_id);
                const isSelected = selectedBug?.record_id === bug.record_id;
                return (
                  <div
                    key={bug.record_id}
                    onClick={() => setSelectedBug(isSelected ? null : bug)}
                    className={`rounded-xl border p-3 cursor-pointer transition-all hover:shadow-sm ${isSelected ? 'border-foreground bg-accent/30' : 'border-border bg-card hover:border-muted-foreground'}`}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          {sgCfg && (
                            <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border font-medium ${sgCfg.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${sgCfg.dot}`} />
                              {bug.fields.schweregrad?.label}
                            </span>
                          )}
                          <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border ${statusCfg.color}`}>
                            {statusCfg.icon}
                            {statusCfg.label}
                          </span>
                          {fixes.length > 0 && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border bg-emerald-50 text-emerald-700 border-emerald-200">
                              <IconTools size={10} className="shrink-0" />
                              {fixes.length} Fix{fixes.length > 1 ? 'es' : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-foreground truncate">{bug.fields.fehler_titel ?? '—'}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                          {bug.betroffene_geraeteName && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <IconDeviceMobile size={11} className="shrink-0" />
                              {bug.betroffene_geraeteName}
                            </span>
                          )}
                          {bug.betroffene_ios_versionName && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <IconVersions size={11} className="shrink-0" />
                              iOS {bug.betroffene_ios_versionName}
                            </span>
                          )}
                          {bug.fields.meldedatum && (
                            <span className="text-xs text-muted-foreground">{formatDate(bug.fields.meldedatum)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => { setEditFehler(bug); setFehlerDialog(true); }}
                          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                          title="Bearbeiten"
                        >
                          <IconPencil size={14} className="shrink-0" />
                        </button>
                        <button
                          onClick={() => setDeleteFehler(bug)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="Löschen"
                        >
                          <IconTrash size={14} className="shrink-0" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Rechte Spalte: Detail-Panel */}
        <div className="xl:col-span-2">
          {selectedBug ? (
            <BugDetailPanel
              bug={selectedBug}
              fixes={selectedBugFixes}
              iosVersionen={iosVersionen}
              geraete={geraete}
              fehlerberichte={fehlerberichte}
              onEditBug={() => { setEditFehler(selectedBug); setFehlerDialog(true); }}
              onAddFix={() => {
                setEditBehebung(null);
                setPrefillFehlerRef(createRecordUrl(APP_IDS.FEHLERBERICHTE, selectedBug.record_id));
                setBehebungDialog(true);
              }}
              onEditFix={(fix) => { setEditBehebung(fix); setPrefillFehlerRef(undefined); setBehebungDialog(true); }}
              onDeleteFix={async (fix) => {
                await LivingAppsService.deleteFehlerbehebungEntry(fix.record_id);
                fetchAll();
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-64 xl:h-full min-h-[240px] rounded-2xl border border-dashed border-border bg-muted/20 gap-3">
              <IconBug size={40} stroke={1.5} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center px-4">Fehler aus der Liste auswählen, um Details anzuzeigen.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <FehlerberichteDialog
        open={fehlerDialog}
        onClose={() => { setFehlerDialog(false); setEditFehler(null); }}
        onSubmit={async (fields) => {
          if (editFehler) {
            await LivingAppsService.updateFehlerberichteEntry(editFehler.record_id, fields);
          } else {
            await LivingAppsService.createFehlerberichteEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editFehler?.fields}
        geraeteList={geraete}
        ios_versionenList={iosVersionen}
        enablePhotoScan={AI_PHOTO_SCAN['Fehlerberichte']}
      />

      <FehlerbehebungDialog
        open={behebungDialog}
        onClose={() => { setBehebungDialog(false); setEditBehebung(null); setPrefillFehlerRef(undefined); }}
        onSubmit={async (fields) => {
          if (editBehebung) {
            await LivingAppsService.updateFehlerbehebungEntry(editBehebung.record_id, fields);
          } else {
            await LivingAppsService.createFehlerbehebungEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editBehebung ? editBehebung.fields : (prefillFehlerRef ? { fehler_referenz: prefillFehlerRef } : undefined)}
        ios_versionenList={iosVersionen}
        fehlerberichteList={fehlerberichte}
        enablePhotoScan={AI_PHOTO_SCAN['Fehlerbehebung']}
      />

      <ConfirmDialog
        open={!!deleteFehler}
        title="Fehlerbericht löschen"
        description={`Fehlerbericht "${deleteFehler?.fields.fehler_titel ?? ''}" wirklich löschen?`}
        onConfirm={handleDeleteFehler}
        onClose={() => setDeleteFehler(null)}
      />
    </div>
  );
}

function BugDetailPanel({
  bug, fixes, iosVersionen, geraete, fehlerberichte,
  onEditBug, onAddFix, onEditFix, onDeleteFix,
}: {
  bug: EnrichedFehlerberichte;
  fixes: EnrichedFehlerbehebung[];
  iosVersionen: import('@/types/app').IosVersionen[];
  geraete: import('@/types/app').Geraete[];
  fehlerberichte: Fehlerberichte[];
  onEditBug: () => void;
  onAddFix: () => void;
  onEditFix: (fix: EnrichedFehlerbehebung) => void;
  onDeleteFix: (fix: EnrichedFehlerbehebung) => void;
}) {
  const statusCfg = STATUS_CONFIG[bug.fields.status?.key ?? 'offen'];
  const sgCfg = SCHWEREGRAD_CONFIG[bug.fields.schweregrad?.key ?? ''];
  const _ = { iosVersionen, geraete, fehlerberichte }; void _;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-2">
        <div className="flex items-start gap-2 justify-between min-w-0">
          <div className="flex flex-wrap gap-1.5 min-w-0">
            {sgCfg && (
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium ${sgCfg.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${sgCfg.dot}`} />
                {bug.fields.schweregrad?.label}
              </span>
            )}
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${statusCfg.color}`}>
              {statusCfg.icon}
              {statusCfg.label}
            </span>
          </div>
          <button
            onClick={onEditBug}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <IconPencil size={14} />
          </button>
        </div>
        <h2 className="font-semibold text-sm text-foreground leading-snug">{bug.fields.fehler_titel ?? '—'}</h2>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {bug.betroffene_geraeteName && (
            <span className="flex items-center gap-1 truncate">
              <IconDeviceMobile size={11} className="shrink-0" />
              {bug.betroffene_geraeteName}
            </span>
          )}
          {bug.betroffene_ios_versionName && (
            <span className="flex items-center gap-1 truncate">
              <IconVersions size={11} className="shrink-0" />
              iOS {bug.betroffene_ios_versionName}
            </span>
          )}
          {bug.fields.meldedatum && (
            <span>Gemeldet: {formatDate(bug.fields.meldedatum)}</span>
          )}
          {(bug.fields.melder_vorname || bug.fields.melder_nachname) && (
            <span className="truncate">Von: {[bug.fields.melder_vorname, bug.fields.melder_nachname].filter(Boolean).join(' ')}</span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3 overflow-y-auto max-h-[380px]">
        {bug.fields.fehler_beschreibung && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Beschreibung</p>
            <p className="text-sm text-foreground whitespace-pre-line">{bug.fields.fehler_beschreibung}</p>
          </div>
        )}
        {bug.fields.schritte_reproduzieren && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Schritte zur Reproduktion</p>
            <p className="text-sm text-foreground whitespace-pre-line">{bug.fields.schritte_reproduzieren}</p>
          </div>
        )}
        {bug.fields.zusaetzliche_hinweise && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Zusätzliche Hinweise</p>
            <p className="text-sm text-foreground whitespace-pre-line">{bug.fields.zusaetzliche_hinweise}</p>
          </div>
        )}
        {bug.fields.screenshot && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Screenshot</p>
            <a href={bug.fields.screenshot} target="_blank" rel="noopener noreferrer">
              <img src={bug.fields.screenshot} alt="Screenshot" className="max-h-40 rounded-lg border border-border object-contain" />
            </a>
          </div>
        )}

        {/* Fehlerbehebungen */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Behebungen ({fixes.length})</p>
            <button
              onClick={onAddFix}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium bg-accent hover:bg-accent/80 text-accent-foreground transition-colors"
            >
              <IconPlus size={11} className="shrink-0" />
              Behebung hinzufügen
            </button>
          </div>
          {fixes.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Noch keine Behebungen eingetragen.</p>
          ) : (
            <div className="space-y-2">
              {fixes.map(fix => {
                const fixStatus = fix.fields.behebungsstatus?.key;
                const fixStatusCfg: Record<string, string> = {
                  in_bearbeitung: 'bg-yellow-100 text-yellow-700',
                  behoben: 'bg-green-100 text-green-700',
                  nicht_behebbar: 'bg-red-100 text-red-700',
                  duplikat: 'bg-slate-100 text-slate-600',
                };
                return (
                  <div key={fix.record_id} className="rounded-xl border border-border bg-muted/30 p-2.5">
                    <div className="flex items-start gap-2 justify-between min-w-0">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap gap-1.5">
                          {fix.fields.behebungsstatus && (
                            <Badge className={`text-xs px-1.5 py-0 h-5 font-normal ${fixStatusCfg[fixStatus ?? ''] ?? 'bg-muted text-muted-foreground'}`}>
                              {fix.fields.behebungsstatus.label}
                            </Badge>
                          )}
                          {fix.behoben_in_versionName && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 font-normal">
                              iOS {fix.behoben_in_versionName}
                            </Badge>
                          )}
                        </div>
                        {fix.fields.fix_beschreibung && (
                          <p className="text-xs text-foreground line-clamp-2">{fix.fields.fix_beschreibung}</p>
                        )}
                        <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                          {(fix.fields.entwickler_vorname || fix.fields.entwickler_nachname) && (
                            <span>{[fix.fields.entwickler_vorname, fix.fields.entwickler_nachname].filter(Boolean).join(' ')}</span>
                          )}
                          {fix.fields.behebungsdatum && (
                            <span>{formatDate(fix.fields.behebungsdatum)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-0.5 shrink-0">
                        <button
                          onClick={() => onEditFix(fix)}
                          className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <IconPencil size={12} />
                        </button>
                        <button
                          onClick={() => onDeleteFix(fix)}
                          className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <IconTrash size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3 space-y-3">
          <Skeleton className="h-9 w-full rounded-xl" />
          <Skeleton className="h-9 w-full rounded-xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
        <div className="xl:col-span-2">
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) {
            setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          }
          if (content.startsWith('[DONE]')) {
            setRepairDone(true);
            setRepairing(false);
          }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) {
            setRepairFailed(true);
          }
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte laden Sie die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktieren Sie den Support.</p>}
    </div>
  );
}
