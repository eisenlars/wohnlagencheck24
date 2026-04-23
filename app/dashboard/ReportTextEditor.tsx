'use client';

import type { ReactNode } from 'react';
import workspaceStyles from './styles/workspace.module.css';

type ReportAreaConfig = {
  area_id: string;
  areas?: {
    name?: string;
  };
};

type ReportTabConfig = {
  id: string;
  label: string;
};

type ReportSectionConfig = {
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
type ReportClassKey = 'general' | 'data_driven' | 'market_expert' | 'profile';

type ReportClassCard = {
  classKey: ReportClassKey;
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

type ReportTextEditorProps = {
  showTopLlmCard: boolean;
  showGlobalClassActions: boolean;
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
  classCards: ReportClassCard[];
  globalBulkReport: BulkReport | null;
  onChangeBulkScope: (scope: BulkScope) => void;
  onSelectClass: (classKey: ReportClassKey) => void;
  onToggleCostInfo: (classKey: ReportClassKey) => void;
  onChangeGlobalPrompt: (classKey: ReportClassKey, prompt: string) => void;
  onRunBulkClass: (classKey: ReportClassKey) => void;
  onScrollToTopicSection: () => void;
  showScopeAreaSidebar: boolean;
  visibleScopeAreaItems: ReportAreaConfig[];
  selectedAreaId: string;
  onSelectScopeArea: (areaId: string) => void;
  visibleTabs: ReportTabConfig[];
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  activeSections: ReportSectionConfig[];
  renderSection: (section: ReportSectionConfig) => ReactNode;
  renderMediaBottom: ReactNode;
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

export default function ReportTextEditor({
  showTopLlmCard,
  showGlobalClassActions,
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
  renderMediaBottom,
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
}: ReportTextEditorProps) {
  return (
    <div className="w-100">
      <div className={showTopLlmCard || showGlobalClassActions ? 'd-grid gap-3' : undefined}>
        {showTopLlmCard ? (
          <div className={workspaceStyles.reportWorkflowTopCard}>
            <div className="d-flex justify-content-end align-items-end flex-wrap gap-3 w-100">
              <label className={`${workspaceStyles.reportWorkflowTopField} d-grid ms-auto`}>
                <select
                  value={selectedLlmIntegrationId || llmIntegrations[0]?.id || ''}
                  onChange={(e) => onSelectLlmIntegration(e.target.value)}
                  className={`${workspaceStyles.workspaceControlSelect} ${workspaceStyles.reportWorkflowTopSelect}`}
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
              </label>
            </div>
          </div>
        ) : null}

        {showGlobalClassActions ? (
          <div className={`${workspaceStyles.reportPanelCard} mb-0`}>
            <div className="d-grid gap-2">
              <div className="d-flex align-items-center gap-3 flex-wrap">
                <h3 className={workspaceStyles.reportSectionTitle}>Bereich wählen -&gt;</h3>
                <label className={workspaceStyles.reportInlineField}>
                  <select
                    value={bulkScope}
                    onChange={(e) => onChangeBulkScope(e.target.value as BulkScope)}
                    className={`${workspaceStyles.workspaceControlSelect} ${workspaceStyles.reportInlineSelect}`}
                    disabled={isBulkRewriting || isOrtslage}
                  >
                    <option value="kreis">Nur Kreis</option>
                    <option value="kreis_ortslagen" disabled={isOrtslage}>Kreis + Ortslagen</option>
                  </select>
                </label>
              </div>
            </div>

            <div className={workspaceStyles.reportClassGrid}>
              {classCards.map((card) => (
                <div
                  key={card.classKey}
                  className={`${workspaceStyles.reportClassCard} ${card.active ? workspaceStyles.reportClassCardActive : ''}`}
                  onClick={() => onSelectClass(card.classKey)}
                >
                  <div className="d-flex align-items-center justify-content-between gap-3">
                    <span className={`${workspaceStyles.reportClassBadge} ${reportClassBadgeClass(card.classKey)}`}>{card.title}</span>
                  </div>
                  <p className="m-0 small text-secondary lh-base">Texttyp: {card.description}</p>
                  <p className="m-0 small lh-base text-dark fw-semibold">Zyklus: {card.cycle}</p>
                  <div className="d-grid gap-1 small text-secondary">
                    <span className="d-flex flex-wrap gap-3 align-items-center">
                      Gebiete: {card.areaMultiplier} Texte: {card.totalTexts} Tokens ca.: {card.totalTokens.toLocaleString('de-DE')}
                    </span>
                  </div>
                  <div className="d-flex flex-wrap gap-3 align-items-center small fw-bold text-dark">
                    <span className="d-flex flex-wrap gap-3 align-items-center">USD ca.: {card.estimatedCostUsd}</span>
                    <span className="d-flex flex-wrap gap-3 align-items-center">EUR ca.: {card.estimatedCostEur}</span>
                    <span className="position-relative d-inline-flex align-items-center gap-1">
                      <button
                        type="button"
                        className={workspaceStyles.reportCostInfoTrigger}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleCostInfo(card.classKey);
                        }}
                        aria-label="Hinweis zur Kostenberechnung"
                      >
                        i
                      </button>
                      {card.costInfoOpen ? (
                        <span className={workspaceStyles.reportCostInfoPopover}>
                          Unverbindliche Schätzung auf Basis von Textlänge, Prompt, Modellpreisen und pauschalem Request-Overhead. Tatsächliche API-Kosten können abweichen.
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <label className="d-grid gap-1 small fw-semibold text-secondary">
                    Standardprompt (anpassbar)
                    <textarea
                      value={card.prompt}
                      onChange={(e) => onChangeGlobalPrompt(card.classKey, e.target.value)}
                      className={workspaceStyles.reportPromptTextarea}
                      placeholder={card.defaultPrompt}
                    />
                  </label>
                  <div className="d-flex justify-content-between align-items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onScrollToTopicSection();
                      }}
                      className={`${workspaceStyles.reportAnchorLink} ${reportClassLinkClass(card.classKey)}`}
                    >
                      Einzeltexte
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!card.active) {
                          onSelectClass(card.classKey);
                          return;
                        }
                        onRunBulkClass(card.classKey);
                      }}
                      disabled={card.disabled}
                      className={`${workspaceStyles.reportClassActionButton} ${reportClassActionClass(card.classKey)}`}
                    >
                      {card.running
                        ? `${card.title} wird optimiert (${classBulkProgress?.done ?? 0}/${classBulkProgress?.total ?? 0})`
                        : 'Alle Texte KI-optimieren'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {globalBulkReport ? (
              <div className={workspaceStyles.reportRunReport}>
                <div className={workspaceStyles.reportRunReportTitle}>Laufbericht</div>
                <div className="small text-secondary mb-1">
                  <strong>Verarbeitet:</strong> {globalBulkReport.processed.length}
                </div>
                <div className="small text-secondary mb-1">
                  <strong>Übersprungen:</strong> {globalBulkReport.skipped.length}
                </div>
                <div className="small text-secondary mb-1">
                  <strong>Fehler:</strong> {globalBulkReport.failed.length}
                </div>
                {globalBulkReport.failed.length > 0 ? (
                  <div className={workspaceStyles.reportRunReportErrors}>
                    {globalBulkReport.failed.slice(0, 8).map((item) => (
                      <div key={`${item.key}:${item.error}`}>- {item.key}: {item.error}</div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={`${workspaceStyles.reportPanelCard} mb-0`}>
        <div id={topicSectionAnchorId} className={`${workspaceStyles.reportSectionIntro} ${workspaceStyles.reportAnchorTarget}`}>
          <h3 className={workspaceStyles.reportSectionTitle}>Themenbereiche prüfen oder bei Bedarf nacharbeiten</h3>
        </div>

        <div className={showScopeAreaSidebar ? workspaceStyles.reportAreaGrid : undefined}>
          {showScopeAreaSidebar ? (
            <aside className="d-grid gap-2 align-self-start px-0 px-lg-3">
              <div className="d-grid gap-2">
                {visibleScopeAreaItems.map((item) => {
                  const itemIsOrtslage = String(item.area_id ?? '').split('-').length > 3;
                  const active = item.area_id === selectedAreaId;
                  return (
                    <button
                      key={item.area_id}
                      type="button"
                      className={`${workspaceStyles.reportAreaListRow} ${active ? workspaceStyles.reportAreaListRowActive : ''} d-grid gap-1 text-start`}
                      onClick={() => onSelectScopeArea(item.area_id)}
                    >
                      <div className="d-flex align-items-center justify-content-between gap-2">
                        <strong className={workspaceStyles.reportAreaHeadline}>{item.areas?.name || item.area_id}</strong>
                        <span className={`${workspaceStyles.reportAreaTypeBadge} ${itemIsOrtslage ? workspaceStyles.reportAreaTypeBadgeChild : ''}`}>{itemIsOrtslage ? 'Ortslage' : 'Kreis'}</span>
                      </div>
                      <div className={workspaceStyles.reportAreaMetaLine}>{item.area_id}</div>
                    </button>
                  );
                })}
              </div>
            </aside>
          ) : null}

          <div className={showScopeAreaSidebar ? workspaceStyles.reportAreaContentWrap : undefined}>
            <div className={`${workspaceStyles.reportAreaContentWrap} d-grid`}>
              <div className={workspaceStyles.reportTabs}>
                {visibleTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => onSelectTab(tab.id)}
                    className={`${workspaceStyles.reportTabButton} ${activeTab === tab.id ? workspaceStyles.reportTabButtonActive : ''}`}
                  >
                    <span className={workspaceStyles.reportTabLabel}>{tab.label}</span>
                  </button>
                ))}
              </div>
              <div className={workspaceStyles.reportContentWrapper}>
                {activeSections.length === 0 ? (
                  <div className={workspaceStyles.reportEmptyState}>
                    Fuer diesen Themenbereich gibt es im gewaehlten Texttyp aktuell keine Texte.
                  </div>
                ) : activeSections.map((section) => renderSection(section))}
                {renderMediaBottom}

                {enableApproval ? (
                  <div className="d-flex flex-column align-items-end gap-3 mt-4">
                    <button
                      type="button"
                      onClick={onSaveAndApprove}
                      className={`${workspaceStyles.reportApproveButton} ${!publishing && hasPublishableChanges ? workspaceStyles.reportApproveButtonActive : ''}`}
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
      </div>

      {saving && <div className={workspaceStyles.reportSaveIndicator}>Speichere Änderungen...</div>}
      {publishModalOpen ? (
        <div className={`${workspaceStyles.reportPublishOverlay} d-flex align-items-center justify-content-center p-3`}>
          <div className={`${workspaceStyles.reportPublishModal} d-grid gap-3`}>
            <h3 className="m-0 fs-5 text-dark">Deutsche Freigabe laeuft</h3>
            <p className="m-0 small text-secondary lh-base">{publishStatus}</p>
            <p className="m-0 small text-dark fw-bold">
              Fortschritt: {publishDone}/{publishTotal}
            </p>
            {publishError ? <p className="m-0 small text-danger">{publishError}</p> : null}
            <div className="d-flex justify-content-end">
              <button
                type="button"
                className={workspaceStyles.reportPublishCloseButton}
                onClick={onClosePublishModal}
                disabled={publishing}
              >
                {publishing ? 'Bitte warten …' : 'Schließen'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const reportClassBadgeClass = (classKey: ReportClassKey): string => {
  if (classKey === 'data_driven') return workspaceStyles.reportClassBadgeDataDriven;
  if (classKey === 'market_expert') return workspaceStyles.reportClassBadgeMarketExpert;
  if (classKey === 'profile') return workspaceStyles.reportClassBadgeProfile;
  return workspaceStyles.reportClassBadgeGeneral;
};

const reportClassLinkClass = (classKey: ReportClassKey): string => {
  if (classKey === 'data_driven') return workspaceStyles.reportClassLinkDataDriven;
  if (classKey === 'market_expert') return workspaceStyles.reportClassLinkMarketExpert;
  if (classKey === 'profile') return workspaceStyles.reportClassLinkProfile;
  return workspaceStyles.reportClassLinkGeneral;
};

const reportClassActionClass = (classKey: ReportClassKey): string => {
  if (classKey === 'data_driven') return workspaceStyles.reportClassActionDataDriven;
  if (classKey === 'market_expert') return workspaceStyles.reportClassActionMarketExpert;
  if (classKey === 'profile') return workspaceStyles.reportClassActionProfile;
  return workspaceStyles.reportClassActionGeneral;
};
