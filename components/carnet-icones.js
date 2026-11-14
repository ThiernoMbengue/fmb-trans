import { StickyNote, ArrowDownLeft, ArrowUpRight, CalendarClock, Wrench, FileText, TriangleAlert } from "lucide-react";

// Une icône par type d'entrée du carnet — le même dessin partout où une
// entrée apparaît (carnet, tableau de bord).
export const ICONE_TYPE = {
  note: StickyNote,
  a_recevoir: ArrowDownLeft,
  a_payer: ArrowUpRight,
  echeance: CalendarClock,
  entretien: Wrench,
  document: FileText,
  incident: TriangleAlert,
};

export const iconeDuType = (type) => ICONE_TYPE[type] || StickyNote;
