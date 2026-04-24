'use client';

import type { ReactNode } from 'react';
import workspaceStyles from './styles/workspace.module.css';
import WorkspacePillTabs from './WorkspacePillTabs';

type MarketingAreaConfig = {
  area_id: string;
  areas?: {
    name?: string;
  };
};

type MarketingTabConfig = {
  id: string;
  label: string;
};

type MarketingSectionConfig = {
  key: string;
  label: string;
  type: string;
};

type LlmIntegrationOption = {
  id: string;
  source: 'partner' | 'global';
  provider: string;
  model: string;
};

type MarketingTextEditorProps = {
  showTopLlmCard: boolean;
  selectedLlmIntegrationId: string;
  llmIntegrations: LlmIntegrationOption[];
  llmOptionsLoading: boolean;
  llmOptionsLoaded: boolean;
  onSelectLlmIntegration: (id: string) => void;
  formatProviderLabel: (provider: string) => string;
  topicSectionAnchorId: string;
  showScopeAreaSidebar: boolean;
  visibleScopeAreaItems: MarketingAreaConfig[];
  selectedAreaId: string;
  onSelectScopeArea: (areaId: string) => void;
  visibleTabs: MarketingTabConfig[];
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  activeSections: MarketingSectionConfig[];
  renderSection: (section: MarketingSectionConfig) => ReactNode;
  enableApproval: boolean;
  publishing: boolean;
  hasPublishableChanges: boolean;
  onSaveAndApprove: () => void;
  saving: boolean;
  publishModalOpen: boolean;
  publishStatus: string;
  publishDone: number;
  publishTotal: number;
  publishError: string | null;
  onClosePublishModal: () => void;
};

export default function MarketingTextEditor({
  showTopLlmCard,
  selectedLlmIntegrationId,
  llmIntegrations,
  llmOptionsLoading,
  llmOptionsLoaded,
  onSelectLlmIntegration,
  formatProviderLabel,
  topicSectionAnchorId,
  showScopeAreaSidebar,
  visibleScopeAreaItems,
  selectedAreaId,
  onSelectScopeArea,
  visibleTabs,
  activeTab,
  onSelectTab,
  activeSections,
  renderSection,
  enableApproval,
  publishing,
  hasPublishableChanges,
  onSaveAndApprove,
  saving,
  publishModalOpen,
  publishStatus,
  publishDone,
  publishTotal,
  publishError,
  onClosePublishModal,
}: MarketingTextEditorProps) {
  return (
    <div className="w-100">
      {showTopLlmCard ? (
        <section className="mb-3">
          <div className={workspaceStyles.workspaceTopControlCard}>
            <div className={workspaceStyles.workspaceTopControlRow}>
              <div className={workspaceStyles.workspaceTopControlFieldModel}>
                <select
                  value={selectedLlmIntegrationId || llmIntegrations[0]?.id || ''}
                  onChange={(e) => onSelectLlmIntegration(e.target.value)}
                  className={`form-select fw-semibold ${workspaceStyles.workspaceTopControlSelect}`}
                  aria-label="KI-Modell auswählen"
                  disabled={llmOptionsLoading || (llmOptionsLoaded && llmIntegrations.length === 0)}
                >
                  {!llmOptionsLoaded || llmOptionsLoading ? <option value="">Modelle werden geladen...</option> : null}
                  {llmOptionsLoaded && llmIntegrations.length === 0 ? <option value="">Kein LLM verfügbar</option> : null}
                  {llmIntegrations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {`${formatProviderLabel(item.provider)} · ${item.model}${item.source === 'global' ? ' (Global)' : ''}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="bg-white border rounded-4 p-3">
        <div id={topicSectionAnchorId} className="mb-3">
          <h3 className="m-0 fs-5 fw-bold text-dark">Themenbereiche prüfen oder bei Bedarf nacharbeiten</h3>
        </div>

        <div className="row g-3 g-xl-4 align-items-start">
          {showScopeAreaSidebar ? (
            <aside className="col-12 col-xl-4">
              <div className="bg-light border rounded-4 p-3">
                <div className="d-flex flex-column gap-2">
                  {visibleScopeAreaItems.map((item) => {
                    const itemIsOrtslage = String(item.area_id ?? '').split('-').length > 3;
                    const active = item.area_id === selectedAreaId;
                    return (
                      <button
                        key={item.area_id}
                        type="button"
                        className={`btn w-100 text-start rounded-3 border p-3 ${active ? 'btn-secondary' : 'btn-light'}`}
                        onClick={() => onSelectScopeArea(item.area_id)}
                      >
                        <span className="d-flex align-items-center justify-content-between gap-2">
                          <strong className="small">{item.areas?.name || item.area_id}</strong>
                          <span className={`badge rounded-pill ${active ? 'text-bg-light' : 'text-bg-secondary'}`}>
                            {itemIsOrtslage ? 'Ortslage' : 'Kreis'}
                          </span>
                        </span>
                        <span className={`d-block small mt-1 ${active ? 'text-white-50' : 'text-secondary'}`}>
                          {item.area_id}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>
          ) : null}

          <div className={showScopeAreaSidebar ? 'col-12 col-xl-8' : 'col-12'}>
            <div className="d-flex flex-column">
              <WorkspacePillTabs
                items={visibleTabs}
                activeId={activeTab}
                onSelect={onSelectTab}
              />

              <div className="d-flex flex-column gap-4">
                {activeSections.length === 0 ? (
                  <div className="border border-secondary-subtle rounded-3 p-3 small text-secondary bg-light">
                    Fuer diesen Themenbereich gibt es im gewaehlten Texttyp aktuell keine Texte.
                  </div>
                ) : activeSections.map((section) => renderSection(section))}

                {enableApproval ? (
                  <div className="d-flex flex-column align-items-end gap-2 mt-2">
                    <button
                      type="button"
                      onClick={onSaveAndApprove}
                      className={`btn fw-bold px-4 py-3 ${!publishing && hasPublishableChanges ? 'btn-success' : 'btn-secondary disabled'}`}
                      disabled={publishing || !hasPublishableChanges}
                    >
                      {publishing ? 'Speichern & Freigeben …' : 'Speichern & Freigeben'}
                    </button>
                    <span className="small text-secondary text-end">
                      Speichert den aktuellen Stand und setzt die deutschen Inhalte auf „freigegeben“.
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {saving ? (
        <div className="position-fixed bottom-0 end-0 m-4 bg-dark text-white rounded-3 px-4 py-3 shadow small">
          Speichere Änderungen...
        </div>
      ) : null}
      {publishModalOpen ? (
        <div className="modal d-block bg-dark bg-opacity-50" tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered" role="dialog" aria-modal="true">
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header">
                <h3 className="modal-title fs-5">Deutsche Freigabe laeuft</h3>
              </div>
              <div className="modal-body d-flex flex-column gap-2">
                <p className="m-0 small text-secondary">{publishStatus}</p>
                <p className="m-0 small fw-bold text-dark">Fortschritt: {publishDone}/{publishTotal}</p>
                {publishError ? <p className="m-0 small text-danger">{publishError}</p> : null}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary fw-semibold"
                  onClick={onClosePublishModal}
                  disabled={publishing}
                >
                  {publishing ? 'Bitte warten …' : 'Schließen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
