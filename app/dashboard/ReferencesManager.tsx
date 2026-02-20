'use client';

import CrmAssetManager from './CrmAssetManager';

export default function ReferencesManager() {
  return (
    <CrmAssetManager
      title="Referenzobjekte"
      rawTable="partner_references"
      overrideTable="partner_reference_overrides"
      emptyHint="Keine Referenzen vorhanden. Nach dem Sync werden hier Live- oder Dummy-Daten angezeigt."
    />
  );
}
