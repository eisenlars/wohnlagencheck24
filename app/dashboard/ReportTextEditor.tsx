'use client';

import type { CSSProperties, ReactNode } from 'react';
import { displayTextBadgeStyle } from '@/lib/text-display-class';
import {
  workflowActionButtonStyle,
  workflowAreaContentStackStyle,
  workflowAreaContentWrapStyle as textAreaEditorWrapStyle,
  workflowAreaGridStyle as textEditorGridStyle,
  workflowAreaHeadlineStyle as textAreaListHeadlineStyle,
  workflowAreaListCardStyle as textAreaListCardStyle,
  workflowAreaListRowStyle as textAreaListRowStyle,
  workflowAreaListRowTopStyle as textAreaListRowTopStyle,
  workflowAreaListWrapStyle as textAreaListWrapStyle,
  workflowAreaMetaLineStyle as textAreaListMetaLineStyle,
  workflowAreaTypeBadgeStyle as textAreaTypeBadgeStyle,
  workflowAnchorLinkStyle,
  workflowClassActionRowStyle as textWorkflowClassActionRowStyle,
  workflowClassCardStyle as textWorkflowClassCardStyle,
  workflowClassCostStyle as textWorkflowClassCostStyle,
  workflowCostInfoPopoverStyle,
  workflowCostInfoTriggerStyle,
  workflowCostInfoWrapStyle,
  workflowClassCycleStyle as textWorkflowClassCycleStyle,
  workflowClassGridStyle as textWorkflowClassGridStyle,
  workflowClassStatLineStyle as textWorkflowClassStatLineStyle,
  workflowClassStatsStyle as textWorkflowClassStatsStyle,
  workflowClassTextStyle as textWorkflowClassTextStyle,
  workflowClassTopStyle as textWorkflowClassTopStyle,
  workflowHeaderInlineStyle as textWorkflowHeaderInlineStyle,
  workflowHeaderStyle as textWorkflowHeaderStyle,
  workflowAnchorTargetStyle,
  workflowInlineFieldStyle as textWorkflowInlineFieldStyle,
  workflowInlineSelectStyle as textWorkflowInlineSelectStyle,
  workflowTopCardStyle as textWorkflowTopCardStyle,
  workflowTopControlsStyle as textWorkflowTopControlsStyle,
  workflowTopFieldStyle as textWorkflowTopFieldStyle,
  workflowTopSelectStyle as textWorkflowTopSelectStyle,
  workflowCardStackStyle,
  workflowPanelCardStyle as textWorkflowCardStyle,
  workflowPromptLabelStyle as textWorkflowPromptLabelStyle,
  workflowPromptTextareaStyle as textWorkflowPromptTextareaStyle,
  workflowSectionIntroStyle as sectionTabsIntroStyle,
  workflowSectionIntroTitleStyle as sectionTabsIntroTitleStyle,
  workflowTabButtonStyle as tabButtonStyle,
  workflowTabContainerStyle as tabContainerStyle,
  workflowTabLabelStyle as tabLabelStyle,
} from '@/app/dashboard/workflow-ui';

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
    <div style={{ width: '100%' }}>
      <div style={showTopLlmCard || showGlobalClassActions ? workflowCardStackStyle : undefined}>
        {showTopLlmCard ? (
          <div style={textWorkflowTopCardStyle}>
            <div style={textWorkflowTopControlsStyle}>
              <label style={textWorkflowTopFieldStyle}>
                <select
                  value={selectedLlmIntegrationId || llmIntegrations[0]?.id || ''}
                  onChange={(e) => onSelectLlmIntegration(e.target.value)}
                  style={textWorkflowTopSelectStyle}
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
          <div style={{ ...textWorkflowCardStyle, marginBottom: 0 }}>
            <div style={textWorkflowHeaderStyle}>
              <div style={textWorkflowHeaderInlineStyle}>
                <h3 style={sectionTabsIntroTitleStyle}>Bereich wählen -&gt;</h3>
                <label style={textWorkflowInlineFieldStyle}>
                  <select
                    value={bulkScope}
                    onChange={(e) => onChangeBulkScope(e.target.value as BulkScope)}
                    style={textWorkflowInlineSelectStyle}
                    disabled={isBulkRewriting || isOrtslage}
                  >
                    <option value="kreis">Nur Kreis</option>
                    <option value="kreis_ortslagen" disabled={isOrtslage}>Kreis + Ortslagen</option>
                  </select>
                </label>
              </div>
            </div>

            <div style={textWorkflowClassGridStyle}>
              {classCards.map((card) => (
                <div
                  key={card.classKey}
                  style={textWorkflowClassCardStyle(card.active)}
                  onClick={() => onSelectClass(card.classKey)}
                >
                  <div style={textWorkflowClassTopStyle}>
                    <span style={textWorkflowClassBadgeStyle(card.classKey)}>{card.title}</span>
                  </div>
                  <p style={textWorkflowClassTextStyle}>Texttyp: {card.description}</p>
                  <p style={textWorkflowClassCycleStyle}>Zyklus: {card.cycle}</p>
                  <div style={textWorkflowClassStatsStyle}>
                    <span style={textWorkflowClassStatLineStyle}>
                      Gebiete: {card.areaMultiplier} Texte: {card.totalTexts} Tokens ca.: {card.totalTokens.toLocaleString('de-DE')}
                    </span>
                  </div>
                  <div style={textWorkflowClassCostStyle}>
                    <span style={textWorkflowClassStatLineStyle}>USD ca.: {card.estimatedCostUsd}</span>
                    <span style={textWorkflowClassStatLineStyle}>EUR ca.: {card.estimatedCostEur}</span>
                    <span style={workflowCostInfoWrapStyle}>
                      <button
                        type="button"
                        style={workflowCostInfoTriggerStyle}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleCostInfo(card.classKey);
                        }}
                        aria-label="Hinweis zur Kostenberechnung"
                      >
                        i
                      </button>
                      {card.costInfoOpen ? (
                        <span style={workflowCostInfoPopoverStyle}>
                          Unverbindliche Schätzung auf Basis von Textlänge, Prompt, Modellpreisen und pauschalem Request-Overhead. Tatsächliche API-Kosten können abweichen.
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <label style={textWorkflowPromptLabelStyle}>
                    Standardprompt (anpassbar)
                    <textarea
                      value={card.prompt}
                      onChange={(e) => onChangeGlobalPrompt(card.classKey, e.target.value)}
                      style={textWorkflowPromptTextareaStyle}
                      placeholder={card.defaultPrompt}
                    />
                  </label>
                  <div style={textWorkflowClassActionRowStyle}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onScrollToTopicSection();
                      }}
                      style={workflowAnchorLinkStyle(String(displayTextBadgeStyle(card.classKey).color ?? '#486b7a'))}
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
                      style={workflowActionButtonStyle({
                        borderColor: String((displayTextBadgeStyle(card.classKey) as Record<string, unknown>).borderColor ?? '#cbd5e1'),
                        background: String(displayTextBadgeStyle(card.classKey).background ?? '#f8fafc'),
                        color: String(displayTextBadgeStyle(card.classKey).color ?? '#475569'),
                        disabled: card.disabled,
                      })}
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
              <div style={globalReportStyle}>
                <div style={globalReportTitleStyle}>Laufbericht</div>
                <div style={globalReportRowStyle}>
                  <strong>Verarbeitet:</strong> {globalBulkReport.processed.length}
                </div>
                <div style={globalReportRowStyle}>
                  <strong>Übersprungen:</strong> {globalBulkReport.skipped.length}
                </div>
                <div style={globalReportRowStyle}>
                  <strong>Fehler:</strong> {globalBulkReport.failed.length}
                </div>
                {globalBulkReport.failed.length > 0 ? (
                  <div style={globalReportErrorListStyle}>
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

      <div style={sectionEditorCardStyle}>
        <div id={topicSectionAnchorId} style={{ ...sectionTabsIntroStyle, ...workflowAnchorTargetStyle }}>
          <h3 style={sectionTabsIntroTitleStyle}>Themenbereiche prüfen oder bei Bedarf nacharbeiten</h3>
        </div>

        <div style={showScopeAreaSidebar ? textEditorGridStyle : undefined}>
          {showScopeAreaSidebar ? (
            <aside style={textAreaListCardStyle}>
              <div style={textAreaListWrapStyle}>
                {visibleScopeAreaItems.map((item) => {
                  const itemIsOrtslage = String(item.area_id ?? '').split('-').length > 3;
                  const active = item.area_id === selectedAreaId;
                  return (
                    <button
                      key={item.area_id}
                      type="button"
                      style={textAreaListRowStyle(active)}
                      onClick={() => onSelectScopeArea(item.area_id)}
                    >
                      <div style={textAreaListRowTopStyle}>
                        <strong style={textAreaListHeadlineStyle}>{item.areas?.name || item.area_id}</strong>
                        <span style={textAreaTypeBadgeStyle(itemIsOrtslage)}>{itemIsOrtslage ? 'Ortslage' : 'Kreis'}</span>
                      </div>
                      <div style={textAreaListMetaLineStyle}>{item.area_id}</div>
                    </button>
                  );
                })}
              </div>
            </aside>
          ) : null}

          <div style={showScopeAreaSidebar ? textAreaEditorWrapStyle : undefined}>
            <div style={workflowAreaContentStackStyle}>
              <div style={tabContainerStyle}>
                {visibleTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => onSelectTab(tab.id)}
                    style={tabButtonStyle(activeTab === tab.id)}
                  >
                    <span style={tabLabelStyle}>{tab.label}</span>
                  </button>
                ))}
              </div>
              <div style={contentWrapperStyle}>
                {activeSections.length === 0 ? (
                  <div style={textWorkflowEmptyStateStyle}>
                    Fuer diesen Themenbereich gibt es im gewaehlten Texttyp aktuell keine Texte.
                  </div>
                ) : activeSections.map((section) => renderSection(section))}
                {renderMediaBottom}

                {enableApproval ? (
                  <div style={approvalFooterStyle}>
                    <button
                      type="button"
                      onClick={onSaveAndApprove}
                      style={approveAllButtonStyle(!publishing && hasPublishableChanges)}
                      disabled={publishing || !hasPublishableChanges}
                    >
                      {publishing ? 'Speichern & Freigeben …' : 'Speichern & Freigeben'}
                    </button>
                    <span style={approvalHintStyle}>
                      Speichert den aktuellen Stand und setzt die deutschen Inhalte auf „freigegeben“.
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      {saving && <div style={saveIndicatorStyle}>Speichere Änderungen...</div>}
      {publishModalOpen ? (
        <div style={publishOverlayStyle}>
          <div style={publishModalStyle}>
            <h3 style={publishTitleStyle}>Deutsche Freigabe laeuft</h3>
            <p style={publishTextStyle}>{publishStatus}</p>
            <p style={publishProgressStyle}>
              Fortschritt: {publishDone}/{publishTotal}
            </p>
            {publishError ? <p style={publishErrorStyle}>{publishError}</p> : null}
            <div style={publishActionsStyle}>
              <button
                type="button"
                style={publishCloseButtonStyle}
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

const sectionEditorCardStyle: CSSProperties = {
  ...textWorkflowCardStyle,
  marginBottom: 0,
};
const contentWrapperStyle = { backgroundColor: '#fff', padding: '40px 20px 0', border: 'none' };
const textWorkflowClassBadgeStyle = (classKey: ReportClassKey): CSSProperties => ({
  ...displayTextBadgeStyle(classKey),
  fontSize: 16,
  lineHeight: 1,
  padding: '10px 20px',
  borderRadius: 999,
  fontWeight: 700,
  letterSpacing: '0.01em',
});
const textWorkflowEmptyStateStyle: CSSProperties = {
  border: '1px dashed #cbd5e1',
  borderRadius: 12,
  padding: '16px 18px',
  fontSize: 13,
  color: '#64748b',
  background: '#f8fafc',
};
const approvalFooterStyle: CSSProperties = {
  marginTop: '24px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: '12px',
};
const approveAllButtonStyle = (active: boolean): CSSProperties => ({
  width: '300px',
  height: '54px',
  borderRadius: '10px',
  border: active ? '1px solid #0f766e' : '1px solid #cbd5e1',
  backgroundColor: active ? '#0f766e' : '#e2e8f0',
  color: active ? '#fff' : '#64748b',
  fontSize: '14px',
  fontWeight: 700,
  cursor: active ? 'pointer' : 'not-allowed',
  opacity: active ? 1 : 0.75,
});
const approvalHintStyle: CSSProperties = {
  fontSize: '12px',
  color: '#64748b',
  textAlign: 'right',
};
const globalReportStyle: CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  backgroundColor: '#ffffff',
  padding: '10px 12px',
  marginTop: '4px',
};
const globalReportTitleStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  color: '#0f172a',
  marginBottom: '6px',
};
const globalReportRowStyle: CSSProperties = {
  fontSize: '12px',
  color: '#334155',
  marginBottom: '3px',
};
const globalReportErrorListStyle: CSSProperties = {
  marginTop: '8px',
  paddingTop: '8px',
  borderTop: '1px dashed #e2e8f0',
  fontSize: '11px',
  color: '#b91c1c',
  display: 'grid',
  gap: '3px',
};
const saveIndicatorStyle: CSSProperties = {
  position: 'fixed',
  bottom: '30px',
  right: '30px',
  backgroundColor: '#0f172a',
  color: '#fff',
  padding: '12px 24px',
  borderRadius: '12px',
  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
  zIndex: 100,
  fontSize: '13px',
};
const publishOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.48)',
  zIndex: 1200,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
};
const publishModalStyle: CSSProperties = {
  width: 'min(620px, 96vw)',
  background: '#ffffff',
  borderRadius: 14,
  border: '1px solid #e2e8f0',
  boxShadow: '0 24px 48px rgba(2, 6, 23, 0.22)',
  padding: 18,
  display: 'grid',
  gap: 12,
};
const publishTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 18,
  color: '#0f172a',
};
const publishTextStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  color: '#334155',
  lineHeight: 1.45,
};
const publishProgressStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: '#0f172a',
  fontWeight: 700,
};
const publishErrorStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: '#b91c1c',
};
const publishActionsStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
};
const publishCloseButtonStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  background: '#fff',
  color: '#0f172a',
  padding: '8px 12px',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
};
