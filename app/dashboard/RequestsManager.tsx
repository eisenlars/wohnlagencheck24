'use client';

import CrmAssetManager from './CrmAssetManager';

export default function RequestsManager() {
  return (
    <CrmAssetManager
      title="Immobiliengesuche"
      rawTable="partner_requests"
      overrideTable="partner_request_overrides"
      emptyHint="Keine Gesuche vorhanden. Nach dem Sync werden hier Live- oder Dummy-Daten angezeigt."
    />
  );
}
