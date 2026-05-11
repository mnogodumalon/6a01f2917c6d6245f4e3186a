import type { Fehlerbehebung, IosVersionen, Fehlerberichte } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { IconPencil } from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd.MM.yyyy', { locale: de }); } catch { return d; }
}

interface FehlerbehebungViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Fehlerbehebung | null;
  onEdit: (record: Fehlerbehebung) => void;
  ios_versionenList: IosVersionen[];
  fehlerberichteList: Fehlerberichte[];
}

export function FehlerbehebungViewDialog({ open, onClose, record, onEdit, ios_versionenList, fehlerberichteList }: FehlerbehebungViewDialogProps) {
  function getIosVersionenDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return ios_versionenList.find(r => r.record_id === id)?.fields.versionsnummer ?? '—';
  }

  function getFehlerberichteDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return fehlerberichteList.find(r => r.record_id === id)?.fields.fehler_titel ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fehlerbehebung anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Beschreibung der Behebung</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.fix_beschreibung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Behoben in iOS-Version</Label>
            <p className="text-sm">{getIosVersionenDisplayName(record.fields.behoben_in_version)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Weitere Notizen</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.behebung_notizen ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Fehlerbericht</Label>
            <p className="text-sm">{getFehlerberichteDisplayName(record.fields.fehler_referenz)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Vorname des Entwicklers</Label>
            <p className="text-sm">{record.fields.entwickler_vorname ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nachname des Entwicklers</Label>
            <p className="text-sm">{record.fields.entwickler_nachname ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Behebungsdatum</Label>
            <p className="text-sm">{formatDate(record.fields.behebungsdatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Behebungsstatus</Label>
            <Badge variant="secondary">{record.fields.behebungsstatus?.label ?? '—'}</Badge>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}