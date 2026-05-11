import type { Fehlerberichte, Geraete, IosVersionen } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { IconPencil, IconFileText } from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd.MM.yyyy', { locale: de }); } catch { return d; }
}

interface FehlerberichteViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Fehlerberichte | null;
  onEdit: (record: Fehlerberichte) => void;
  geraeteList: Geraete[];
  ios_versionenList: IosVersionen[];
}

export function FehlerberichteViewDialog({ open, onClose, record, onEdit, geraeteList, ios_versionenList }: FehlerberichteViewDialogProps) {
  function getGeraeteDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return geraeteList.find(r => r.record_id === id)?.fields.geraet_name ?? '—';
  }

  function getIosVersionenDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return ios_versionenList.find(r => r.record_id === id)?.fields.versionsnummer ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fehlerberichte anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Betroffene Geräte</Label>
            <p className="text-sm">{getGeraeteDisplayName(record.fields.betroffene_geraete)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Meldedatum</Label>
            <p className="text-sm">{formatDate(record.fields.meldedatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Vorname des Melders</Label>
            <p className="text-sm">{record.fields.melder_vorname ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nachname des Melders</Label>
            <p className="text-sm">{record.fields.melder_nachname ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">E-Mail des Melders</Label>
            <p className="text-sm">{record.fields.melder_email ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Screenshot / Anhang</Label>
            {record.fields.screenshot ? (
              <div className="relative w-full rounded-lg bg-muted overflow-hidden border">
                <img src={record.fields.screenshot} alt="" className="w-full h-auto object-contain" />
              </div>
            ) : <p className="text-sm text-muted-foreground">—</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Zusätzliche Hinweise</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.zusaetzliche_hinweise ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Betroffene iOS-Version</Label>
            <p className="text-sm">{getIosVersionenDisplayName(record.fields.betroffene_ios_version)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Fehlertitel</Label>
            <p className="text-sm">{record.fields.fehler_titel ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Fehlerbeschreibung</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.fehler_beschreibung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Schritte zur Reproduktion</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.schritte_reproduzieren ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Schweregrad</Label>
            <Badge variant="secondary">{record.fields.schweregrad?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Badge variant="secondary">{record.fields.status?.label ?? '—'}</Badge>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}