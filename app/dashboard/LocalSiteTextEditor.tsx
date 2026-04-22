'use client';

import type { ReactNode } from 'react';

type LocalSiteAreaConfig = {
  area_id: string;
  areas?: {
    name?: string;
  };
};

type LocalSiteTabConfig = {
  id: string;
  label: string;
};

type LocalSiteSectionConfig = {
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

type BulkScope = 'kreis' | 'kreis_ortslagen';
type LocalSiteClassKey = 'general' | 'data_driven' | 'market_expert' | 'profile';

type LocalSiteClassCard = {
  classKey: LocalSiteClassKey;
  title: string;
  description: string;
  cycle: string;
  defaultPrompt: string;
  totalTexts: number;
  areaMultiplier: number;
  totalTokens: number;
  estimatedCostUsd: string;
  estimatedCostEur: string;
  prompt: string;
  active: boolean;
  running: boolean;
  disabled: boolean;
  costInfoOpen: boolean;
};

type BulkReport = {
  processed: string[];
  skipped: string[];
  failed: Array<{ key: string; error: string }>;
};

type LocalSiteTextEditorProps = {
  showTopLlmCard: boolean;
  selectedLlmIntegrationId: string;
  llmIntegrations: LlmIntegrationOption[];
  llmOptionsLoading: boolean;
  llmOptionsLoaded: boolean;
  onSelectLlmIntegration: (id: string) => void;
  formatProviderLabel: (provider: string) => string;
  topicSectionAnchorId: string;
  bulkScope: BulkScope;
  isOrtslage: boolean;
  isBulkRewriting: boolean;
  classBulkProgress: { done: number; total: number } | null;
  classCards: LocalSiteClassCard[];
  globalBulkReport: BulkReport | null;
  onChangeBulkScope: (scope: BulkScope) => void;
  onSelectClass: (classKey: LocalSiteClassKey) => void;
  onToggleCostInfo: (classKey: LocalSiteClassKey) => void;
  onChangeGlobalPrompt: (classKey: LocalSiteClassKey, prompt: string) => void;
  onRunBulkClass: (classKey: LocalSiteClassKey) => void;
  onScrollToTopicSection: () => void;
  showScopeAreaSidebar: boolean;
  visibleScopeAreaItems: LocalSiteAreaConfig[];
  selectedAreaId: string;
  onSelectScopeArea: (areaId: string) => void;
  visibleTabs: LocalSiteTabConfig[];
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  activeSections: LocalSiteSectionConfig[];
  renderSection: (section: LocalSiteSectionConfig) => ReactNode;
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

export default function LocalSiteTextEditor({
  showTopLlmCard,
  selectedLlmIntegrationId,
  llmIntegrations,
  llmOptionsLoading,
  llmOptionsLoaded,
  onSelectLlmIntegration,
  formatProviderLabel,
  topicSectionAnchorId,
  bulkScope,
  isOrtslage,
  isBulkRewriting,
  classBulkProgress,
  classCards,
  globalBulkReport,
  onChangeBulkScope,
  onSelectClass,
  onToggleCostInfo,
  onChangeGlobalPrompt,
  onRunBulkClass,
  onScrollToTopicSection,
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
}: LocalSiteTextEditorProps) {
  return (
    <div className="w-100 d-flex flex-column gap-3">
      {showTopLlmCard ? (
        <section className="border border-success-subtle rounded-3 p-3 bg-success-subtle">
          <div className="row g-3 align-items-center">
            <div className="col-12 col-xl-4 ms-xl-auto">
              <select
                value={selectedLlmIntegrationId || llmIntegrations[0]?.id || ''}
                onChange={(e) => onSelectLlmIntegration(e.target.value)}
                className="form-select fw-semibold"
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
        </section>
      ) : null}

      <section className="bg-white border rounded-4 p-3 p-xl-4">
        <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap mb-3">
          <h3 className="m-0 fs-5 fw-bold text-dark">Bereich wählen</h3>
          <div className="d-flex align-items-center gap-2">
            <label className="small fw-semibold text-secondary" htmlFor="local-site-bulk-scope">
              KI-Scope
            </label>
            <select
              id="local-site-bulk-scope"
              value={bulkScope}
              onChange={(e) => onChangeBulkScope(e.target.value as BulkScope)}
              className="form-select form-select-sm fw-semibold"
              disabled={isBulkRewriting || isOrtslage}
            >
              <option value="kreis">Nur Kreis</option>
              <option value="kreis_ortslagen" disabled={isOrtslage}>Kreis + Ortslagen</option>
            </select>
          </div>
        </div>

        <div className="row g-3">
          {classCards.map((card) => (
            <div key={card.classKey} className="col-12 col-lg-4">
              <article
                className={`h-100 border rounded-4 p-3 d-flex flex-column gap-2 ${card.active ? 'bg-light border-secondary' : 'bg-white'}`}
                role="button"
                tabIndex={0}
                onClick={() => onSelectClass(card.classKey)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') onSelectClass(card.classKey);
                }}
              >
                <div className="d-flex align-items-center justify-content-between gap-2">
                  <span className="badge rounded-pill text-bg-secondary px-3 py-2">{card.title}</span>
                  {card.running ? (
                    <span className="badge rounded-pill text-bg-info">
                      {classBulkProgress?.done ?? 0}/{classBulkProgress?.total ?? 0}
                    </span>
                  ) : null}
                </div>
                <p className="m-0 small text-secondary">{card.description}</p>
                <p className="m-0 small text-secondary">Zyklus: {card.cycle}</p>
                <div className="small text-dark fw-semibold">
                  Gebiete: {card.areaMultiplier} Texte: {card.totalTexts} Tokens ca.: {card.totalTokens.toLocaleString('de-DE')}
                </div>
                <div className="d-flex align-items-center gap-2 flex-wrap small text-secondary">
                  <span>USD ca.: {card.estimatedCostUsd}</span>
                  <span>EUR ca.: {card.estimatedCostEur}</span>
                  <span className="position-relative d-inline-flex">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary rounded-circle fw-bold lh-1"
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleCostInfo(card.classKey);
                      }}
                      aria-label="Hinweis zur Kostenberechnung"
                    >
                      i
                    </button>
                    {card.costInfoOpen ? (
                      <span className="position-absolute top-100 start-0 mt-2 bg-white border rounded-3 shadow p-2 small text-secondary z-3">
                        Unverbindliche Schätzung auf Basis von Textlänge, Prompt, Modellpreisen und pauschalem Request-Overhead. Tatsächliche API-Kosten können abweichen.
                      </span>
                    ) : null}
                  </span>
                </div>
                <label className="form-label small fw-semibold text-dark mb-0 d-flex flex-column gap-1">
                  <span>Standardprompt (anpassbar)</span>
                  <textarea
                    value={card.prompt}
                    onChange={(event) => onChangeGlobalPrompt(card.classKey, event.target.value)}
                    className="form-control form-control-sm"
                    rows={4}
                    placeholder={card.defaultPrompt}
                  />
                </label>
                <div className="d-flex align-items-center gap-2 flex-wrap mt-auto">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary fw-semibold"
                    onClick={(event) => {
                      event.stopPropagation();
                      onScrollToTopicSection();
                    }}
                  >
                    Einzeltexte
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary fw-semibold"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!card.active) {
                        onSelectClass(card.classKey);
                        return;
                      }
                      onRunBulkClass(card.classKey);
                    }}
                    disabled={card.disabled}
                  >
                    {card.running ? `${card.title} wird optimiert (${classBulkProgress?.done ?? 0}/${classBulkProgress?.total ?? 0})` : 'Alle Texte KI-optimieren'}
                  </button>
                </div>
              </article>
            </div>
          ))}
        </div>

        {globalBulkReport ? (
          <div className="border rounded-3 bg-light p-3 mt-3 small text-secondary">
            <div className="fw-bold text-dark mb-2">Laufbericht</div>
            <div><strong>Verarbeitet:</strong> {globalBulkReport.processed.length}</div>
            <div><strong>Übersprungen:</strong> {globalBulkReport.skipped.length}</div>
            <div><strong>Fehler:</strong> {globalBulkReport.failed.length}</div>
            {globalBulkReport.failed.length > 0 ? (
              <div className="border-top border-secondary-subtle mt-2 pt-2 text-danger d-grid gap-1">
                {globalBulkReport.failed.slice(0, 8).map((item) => (
                  <div key={`${item.key}:${item.error}`}>- {item.key}: {item.error}</div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="bg-white border rounded-4 p-3 p-xl-4">
        <div id={topicSectionAnchorId} className="mb-4">
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
            <div className="d-flex flex-column gap-4">
              <div className="d-flex flex-wrap gap-2 my-4">
                {visibleTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onSelectTab(tab.id)}
                    className={`btn btn-sm rounded-pill px-3 ${
                      activeTab === tab.id ? 'btn-secondary fw-bold' : 'btn-outline-secondary fw-semibold'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

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
