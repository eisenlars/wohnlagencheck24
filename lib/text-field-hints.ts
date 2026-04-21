export type HintTable = 'report_texts' | 'partner_local_site_texts' | 'partner_marketing_texts';
export type HintType = 'general' | 'data_driven' | 'individual' | 'marketing';

export function resolveFieldHint(args: {
  tableName: HintTable;
  type: string;
  sectionKey: string;
}): string | null {
  const tableName = String(args.tableName ?? '');
  const type = String(args.type ?? '').trim().toLowerCase() as HintType;
  const sectionKey = String(args.sectionKey ?? '').trim().toLowerCase();

  if (tableName === 'partner_marketing_texts') {
    if (type !== 'marketing') return null;
    return 'Marketingtext: Für Sichtbarkeit in Suche und KI-Antworten. Kurz, klar und faktenbasiert halten.';
  }

  if (type === 'data_driven') {
    return 'Achtung: Datengenerierter Text. Manuelle Änderungen können den Kontext verfälschen.';
  }
  if (type === 'general') {
    return 'General-Text: Teaser und erklärende Standardtexte für den schnellen Einstieg.';
  }
  if (type === 'individual') {
    if (sectionKey === 'berater_ausbildung') {
      return 'Qualifikationen können als Fließtext oder Liste gepflegt werden. Für Listen bitte je Zeile mit "- " beginnen.';
    }
    if (sectionKey.startsWith('berater_') || sectionKey.startsWith('makler_')) {
      return 'Profiltext: Bei Änderungen an Person, Rolle oder Leistungen bitte aktualisieren.';
    }
    return 'Market-Expert-Text: Für individuelle Markt-/Lageeinschätzungen mit regionalem Bezug.';
  }

  return null;
}
