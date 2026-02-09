'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/utils/supabase/client';
import FactorForm, { type FactorFormHandle } from './FactorForm';
import TextEditorForm from './TextEditorForm';
import OffersManager from './OffersManager';
import BlogManager from './BlogManager';

type MainTab = 'texts' | 'factors' | 'marketing' | 'local_site' | 'immobilien' | 'gesuche' | 'blog';

type PartnerArea = {
  id?: string;
  name?: string;
  slug?: string;
  parent_slug?: string;
  bundesland_slug?: string;
};

type PartnerAreaConfig = {
  area_id: string;
  areas?: PartnerArea;
  is_active?: boolean;
  [key: string]: unknown;
};

export default function DashboardClient() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const factorFormRef = useRef<FactorFormHandle | null>(null);
  const [configs, setConfigs] = useState<PartnerAreaConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<PartnerAreaConfig | null>(null);
  const [expandedDistrict, setExpandedDistrict] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastLogin, setLastLogin] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [utilityCollapsed, setUtilityCollapsed] = useState(false);
  const [utilityUserToggled, setUtilityUserToggled] = useState(false);
  const [textFocusKey, setTextFocusKey] = useState<string | null>(null);

  // Werkzeug-Modus umschalten
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('factors');

  const headerConfig = useMemo(() => {
    switch (activeMainTab) {
      case 'texts':
        return {
          title: 'Berichte & Texte',
          description: 'Texte und Berichte für die ausgewählte Region verwalten und optimieren.',
          isRegionBased: true,
        };
      case 'factors':
        return {
          title: 'Preisfaktoren',
          description: 'Preisfaktoren der Region prüfen und bei Bedarf anpassen.',
          isRegionBased: true,
        };
      case 'marketing':
        return {
          title: 'Online-Marketing',
          description: 'Marketing-Informationen der Region pflegen und ausrichten.',
          isRegionBased: true,
        };
      case 'local_site':
        return {
          title: 'Lokale Website',
          description: 'Regionale Inhalte für die lokale Website bearbeiten.',
          isRegionBased: true,
        };
      case 'blog':
        return {
          title: 'Blog',
          description: 'Blogbeiträge aus Marktüberblick-Texten generieren und veröffentlichen.',
          isRegionBased: true,
        };
      case 'gesuche':
        return {
          title: 'Gesuche',
          description: 'Gesuche für die ausgewählte Region verwalten.',
          isRegionBased: true,
        };
      case 'immobilien':
      default:
        return {
          title: 'Immobilien',
          description: 'SEO-Texte und Exposé-Inhalte pro Objekt individuell optimieren.',
          isRegionBased: false,
        };
    }
  }, [activeMainTab]);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      queueMicrotask(() => {
        setLastLogin(user.last_sign_in_at ?? null);
      });

      const { data } = await supabase
        .from('partner_area_map')
        .select(`*, areas ( name, id, slug, parent_slug, bundesland_slug )`)
        .eq('auth_user_id', user.id)
        .order('area_id', { ascending: true });

      queueMicrotask(() => {
        if (data && data.length > 0) {
          setConfigs(data);
          setSelectedConfig(data[0]);
          setExpandedDistrict(data[0].area_id.split('-').slice(0, 3).join('-'));
        }
        setLoading(false);
      });
    }
    loadData();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleToolSelect = (tab: MainTab) => {
    setActiveMainTab(tab);
    setShowWelcome(false);
    if (tab === 'blog') {
      const kreis = configs.find((c) => c.area_id.split('-').length <= 3);
      if (kreis) setSelectedConfig(kreis);
    }
  };

  const handleToggleUtility = () => {
    const effectiveCollapsed = utilityUserToggled ? utilityCollapsed : showWelcome;
    setUtilityUserToggled(true);
    setUtilityCollapsed(!effectiveCollapsed);
  };

  if (loading) return <div style={{ padding: '40px' }}>Dashboard wird geladen...</div>;

  const mainDistricts = configs.filter(c => c.area_id.split('-').length <= 3);
  const effectiveUtilityCollapsed = utilityUserToggled ? utilityCollapsed : showWelcome;

  const handleSelectConfig = async (nextConfig: PartnerAreaConfig) => {
    const current = selectedConfig;
    const currentIsKreis = (current?.area_id?.split?.('-')?.length ?? 0) <= 3;
    const nextIsOrt = (nextConfig?.area_id?.split?.('-')?.length ?? 0) > 3;
    if (activeMainTab === 'factors' && currentIsKreis && nextIsOrt && factorFormRef.current) {
      await factorFormRef.current.autoSyncIfDirty();
    }
    setSelectedConfig(nextConfig);
    setShowWelcome(false);
    if (!utilityUserToggled) setUtilityCollapsed(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', backgroundColor: '#f8fafc' }}>
      <header style={dashboardHeaderStyle}>
        <div
          className="brand-header"
          style={{ margin: 0, cursor: 'pointer' }}
          onClick={() => setShowWelcome(true)}
          title="Zur Willkommensseite"
        >
          <Image
            alt="Immobilienmarkt & Standortprofile"
            width={48}
            height={48}
            src="/logo/wohnlagencheck24.svg"
            className="brand-icon"
            style={{ display: 'block' }}
            priority
          />
          <span className="brand-text">
            <span className="brand-title">
              Wohnlagencheck<span style={{ color: '#ffe000' }}>24</span>
            </span>
            <small>DATA-DRIVEN. EXPERT-LED.</small>
          </span>
        </div>
        <div style={dashboardStatusStyle}>
          {lastLogin ? `Letzter Login: ${new Date(lastLogin).toLocaleString('de-DE')}` : 'Letzter Login: –'}
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

      {/* 1. SPALTE: WERKZEUGE (Ganz links, schmal) */}
      <aside style={utilityBarStyle(effectiveUtilityCollapsed)}>
        <div style={toolIconsGroupStyle}>
          <button
            onClick={handleToggleUtility}
            style={toolIconButtonStyle(false)}
            title={effectiveUtilityCollapsed ? 'Menü ausklappen' : 'Menü einklappen'}
          >
            {effectiveUtilityCollapsed ? '»' : '«'}
          </button>
          {!effectiveUtilityCollapsed ? (
            <>
          <button
            onClick={() => handleToolSelect('factors')}
            style={toolIconButtonStyle(activeMainTab === 'factors')}
            title="Preisfaktoren"
          >
            📊
          </button>
          <button
            onClick={() => handleToolSelect('texts')}
            style={toolIconButtonStyle(activeMainTab === 'texts')}
            title="Berichte & Texte"
          >
            ✍️
          </button>
          <button
            onClick={() => handleToolSelect('marketing')}
            style={toolIconButtonStyle(activeMainTab === 'marketing')}
            title="Online-Marketing"
          >
            📈
          </button>
          <button
            onClick={() => handleToolSelect('local_site')}
            style={toolIconButtonStyle(activeMainTab === 'local_site')}
            title="Lokale Website"
          >
            🧭
          </button>
          <button
            onClick={() => handleToolSelect('blog')}
            style={toolIconButtonStyle(activeMainTab === 'blog')}
            title="Blog"
          >
            📝
          </button>
          <button
            onClick={() => handleToolSelect('immobilien')}
            style={toolIconButtonStyle(activeMainTab === 'immobilien')}
            title="Immobilien"
          >
            🏠
          </button>
          <button
            onClick={() => handleToolSelect('gesuche')}
            style={toolIconButtonStyle(activeMainTab === 'gesuche')}
            title="Gesuche"
          >
            🔎
          </button>
          <button
            style={toolIconButtonStyle(false, true)}
            disabled
            title="Werbung (In Kürze)"
          >
            📢
          </button>
            </>
          ) : null}
          <button
            onClick={handleLogout}
            style={logoutButtonStyle}
            title="Abmelden"
          >
            <span aria-hidden>⎋</span>
          </button>
        </div>
      </aside>

      {/* 2. SPALTE: REGIONEN-NAVIGATION (Mitte) */}
      {activeMainTab !== 'immobilien' && !showWelcome ? (
        <aside style={regionSidebarStyle}>
          <div style={sidebarHeaderStyle}>
            <h2 style={{ fontSize: '14px', fontWeight: '800', margin: 0 }}>Regionen</h2>
            <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', textTransform: 'uppercase' }}>
              {activeMainTab === 'factors' ? 'Faktor-Anpassung' : 'Content Management'}
            </p>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
            {mainDistricts.map(district => {
              const isSelected = selectedConfig?.area_id.startsWith(district.area_id);
              const isExpanded = expandedDistrict === district.area_id;
              const allowSubAreas = activeMainTab !== 'blog';
              const subAreas = allowSubAreas
                ? configs.filter(c => c.area_id.startsWith(district.area_id) && c.area_id.split('-').length > 3)
                : [];

              return (
                <div key={district.area_id} style={{ marginBottom: '8px' }}>
                  <button
                    onClick={() => {
                      handleSelectConfig(district);
                      setExpandedDistrict(isExpanded ? null : district.area_id);
                    }}
                    style={districtButtonStyle(isSelected)}
                  >
                    <span style={{ fontSize: '10px' }}>{isExpanded ? '▼' : '▶'}</span>
                    <span style={{ flex: 1, textAlign: 'left' }}>{district.areas?.name}</span>
                  </button>

                  {isExpanded && subAreas.length > 0 && (
                    <div style={subAreaListStyle}>
                      {subAreas.map(ort => (
                        <button
                          key={ort.area_id}
                          onClick={() => handleSelectConfig(ort)}
                          style={subAreaButtonStyle(selectedConfig?.id === ort.id)}
                        >
                          {ort.areas?.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      ) : null}

      {/* 3. SPALTE: ARBEITSBEREICH (Rechts) */}
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: activeMainTab === 'immobilien' ? '24px 48px' : '40px',
        }}
      >
        {showWelcome ? (
          <div style={welcomeWrapStyle}>
            <div style={welcomeHeaderStyle}>
              <h1 style={welcomeTitleStyle}>Willkommen im Partnerbereich</h1>
              <p style={welcomeTextStyle}>
                Hier verwalten Sie Preisfaktoren, Texte und Marketing-Inhalte für Ihre Regionen.
                Wählen Sie einen Bereich aus, um direkt zu starten.
              </p>
            </div>
            <div style={welcomeGridStyle}>
              {welcomeTools.map(tool => (
                <button
                  key={tool.key}
                  onClick={() => handleToolSelect(tool.key)}
                  style={welcomeCardStyle}
                >
                  <div style={welcomeCardIconStyle}>{tool.icon}</div>
                  <div style={welcomeCardTitleStyle}>{tool.title}</div>
                  <div style={welcomeCardTextStyle}>{tool.description}</div>
                </button>
              ))}
            </div>
          </div>
        ) : selectedConfig ? (
          /* Hier entfernen wir das maxWidth: '1000px' damit die Formulare die Breite nutzen */
          <div style={{ width: '100%' }}>
            <header style={{ marginBottom: '30px' }}>
              <div style={{ marginBottom: '6px' }}>
                <h1 style={mainTitleStyle}>{headerConfig.title}</h1>
                <p style={headerDescriptionStyle}>{headerConfig.description}</p>
              </div>
              {headerConfig.isRegionBased && selectedConfig ? (
                <>
                  <div style={breadcrumbStyle}>
                    Regionen / {selectedConfig.area_id.split('-').length > 3 ? 'Ortslage' : 'Kreis'}
                  </div>
                  <h2 style={regionTitleStyle}>{selectedConfig.areas?.name}</h2>
                </>
              ) : null}
            </header>

            {/* Die Forms nutzen nun die volle Breite des <main> Containers */}
            {activeMainTab === 'factors' ? (
              <FactorForm ref={factorFormRef} key={`f-${selectedConfig.id}`} config={selectedConfig} />
            ) : activeMainTab === 'texts' ? (
              <TextEditorForm
                key={`t-${selectedConfig.id}`}
                config={selectedConfig}
                initialTabId={textFocusKey ? 'marktueberblick' : undefined}
                focusSectionKey={textFocusKey ?? undefined}
                onFocusHandled={() => setTextFocusKey(null)}
              />
            ) : activeMainTab === 'marketing' ? (
              <TextEditorForm
                key={`mkt-${selectedConfig.id}`}
                config={selectedConfig}
                tableName="partner_marketing_texts"
                enableApproval
              />
            ) : activeMainTab === 'local_site' ? (
              <TextEditorForm
                key={`ls-${selectedConfig.id}`}
                config={selectedConfig}
                tableName="partner_local_site_texts"
                enableApproval
              />
            ) : activeMainTab === 'blog' ? (
              <BlogManager
                key={`blog-${selectedConfig.id}`}
                config={selectedConfig}
                onNavigateToTexts={(sectionKey) => {
                  setTextFocusKey(sectionKey);
                  setActiveMainTab('texts');
                  setShowWelcome(false);
                  if (!utilityUserToggled) setUtilityCollapsed(false);
                }}
              />
            ) : activeMainTab === 'immobilien' ? (
              <OffersManager />
            ) : (
              <div style={{ padding: '20px', color: '#64748b' }}>
                Bereich in Vorbereitung.
              </div>
            )}
          </div>
        ) : (
          <div style={emptyStateStyle}>Wählen Sie eine Region aus der mittleren Spalte.</div>
        )}
      </main>
      </div>
    </div>
  );
}

// --- STYLES ---

const utilityBarStyle = (collapsed: boolean): React.CSSProperties => ({
  width: collapsed ? '56px' : '80px',
  backgroundColor: 'rgb(72, 107, 122)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: collapsed ? '16px 0px' : '20px 0px',
  zIndex: 10
});

const toolIconsGroupStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '16px'
};

const toolIconButtonStyle = (active: boolean, disabled = false) => ({
  width: '48px',
  height: '48px',
  borderRadius: '12px',
  border: 'none',
  backgroundColor: active ? '#e2e8f0' : '#fff',
  boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
  fontSize: '20px',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.3 : 1,
  transition: 'all 0.2s',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
});

const logoutButtonStyle: React.CSSProperties = {
  marginTop: '8px',
  width: '48px',
  height: '48px',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  backgroundColor: '#fff',
  color: '#0f172a',
  fontSize: '18px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const dashboardHeaderStyle: React.CSSProperties = {
  minHeight: '72px',
  backgroundColor: '#fff',
  color: '#0f172a',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 20px',
  borderBottom: '1px solid #e2e8f0',
  position: 'sticky',
  top: 0,
  zIndex: 40
};

const dashboardStatusStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#94a3b8'
};

const regionSidebarStyle: React.CSSProperties = {
  width: '260px',
  backgroundColor: '#fff',
  borderRight: '1px solid #e2e8f0',
  display: 'flex',
  flexDirection: 'column'
};

const sidebarHeaderStyle = {
  padding: '24px',
  borderBottom: '1px solid #f1f5f9'
};

const districtButtonStyle = (active: boolean) => ({
  width: '100%',
  padding: '10px 12px',
  border: 'none',
  borderRadius: '8px',
  backgroundColor: active ? '#f1f5f9' : 'transparent',
  color: active ? '#1e293b' : '#64748b',
  fontWeight: active ? '700' : '500',
  fontSize: '14px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '10px'
});

const subAreaListStyle = {
  marginLeft: '24px',
  marginTop: '4px',
  borderLeft: '1px solid #e2e8f0',
  paddingLeft: '8px'
};

const subAreaButtonStyle = (active: boolean) => ({
  width: '100%',
  textAlign: 'left' as const,
  padding: '6px 10px',
  border: 'none',
  borderRadius: '6px',
  backgroundColor: active ? '#eff6ff' : 'transparent',
  color: active ? '#2563eb' : '#64748b',
  fontSize: '13px',
  fontWeight: active ? '700' : '500',
  cursor: 'pointer'
});

const mainTitleStyle = {
  fontSize: '32px',
  fontWeight: '800',
  color: '#0f172a',
  margin: 0,
  letterSpacing: '-0.02em'
};

const headerDescriptionStyle = {
  margin: '6px 0 0',
  fontSize: '14px',
  color: '#64748b'
};

const breadcrumbStyle = {
  fontSize: '12px',
  color: '#94a3b8',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  marginBottom: '8px'
};

const regionTitleStyle = {
  fontSize: '24px',
  fontWeight: '700',
  color: '#0f172a',
  margin: 0,
  letterSpacing: '-0.01em'
};

const emptyStateStyle = {
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#94a3b8'
};

const welcomeTools: Array<{ key: MainTab; title: string; description: string; icon: string }> = [
  {
    key: 'factors',
    title: 'Preisfaktoren',
    description: 'Preisfaktoren der Region prüfen und bei Bedarf anpassen.',
    icon: '📊',
  },
  {
    key: 'texts',
    title: 'Berichte & Texte',
    description: 'Texte und Berichte für die ausgewählte Region verwalten und optimieren.',
    icon: '✍️',
  },
  {
    key: 'marketing',
    title: 'Online-Marketing',
    description: 'Marketing-Informationen der Region pflegen und ausrichten.',
    icon: '📈',
  },
  {
    key: 'local_site',
    title: 'Lokale Website',
    description: 'Regionale Inhalte für die lokale Website bearbeiten.',
    icon: '🧭',
  },
  {
    key: 'blog',
    title: 'Blog',
    description: 'Blogbeiträge aus Marktüberblick-Texten generieren.',
    icon: '📝',
  },
  {
    key: 'immobilien',
    title: 'Immobilien',
    description: 'SEO-Texte und Exposé-Inhalte pro Objekt individuell optimieren.',
    icon: '🏠',
  },
  {
    key: 'gesuche',
    title: 'Gesuche',
    description: 'Gesuche für die ausgewählte Region verwalten.',
    icon: '🔎',
  },
];

const welcomeWrapStyle = {
  maxWidth: '1100px',
  margin: '0 auto',
  padding: '20px 10px 40px',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '28px',
};

const welcomeHeaderStyle = {
  backgroundColor: '#fff',
  borderRadius: '18px',
  padding: '28px 32px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 8px 16px rgba(15, 23, 42, 0.06)',
};

const welcomeTitleStyle = {
  margin: 0,
  fontSize: '34px',
  fontWeight: 800,
  color: '#0f172a',
  letterSpacing: '-0.02em',
};

const welcomeTextStyle = {
  margin: '10px 0 0',
  fontSize: '16px',
  color: '#475569',
  lineHeight: 1.5,
};

const welcomeGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '16px',
};

const welcomeCardStyle = {
  backgroundColor: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  padding: '20px',
  textAlign: 'left' as const,
  cursor: 'pointer',
  boxShadow: '0 10px 18px rgba(15, 23, 42, 0.06)',
  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
};

const welcomeCardIconStyle = {
  fontSize: '26px',
  marginBottom: '12px',
};

const welcomeCardTitleStyle = {
  fontSize: '16px',
  fontWeight: 800,
  color: '#0f172a',
  marginBottom: '6px',
};

const welcomeCardTextStyle = {
  fontSize: '13px',
  color: '#64748b',
  lineHeight: 1.4,
};
