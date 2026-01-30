'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import FactorForm from './FactorForm';
import TextEditorForm from './TextEditorForm';

export default function DashboardClient() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [configs, setConfigs] = useState<any[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<any>(null);
  const [expandedDistrict, setExpandedDistrict] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastLogin, setLastLogin] = useState<string | null>(null);

  // Werkzeug-Modus umschalten
  const [activeMainTab, setActiveMainTab] = useState<
    'texts' | 'factors' | 'marketing' | 'local_site' | 'immobilien' | 'gesuche'
  >('texts');

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setLastLogin(user.last_sign_in_at ?? null);

      const { data } = await supabase
        .from('partner_area_map')
        .select(`*, areas ( name, id, slug, parent_slug, bundesland_slug )`)
        .eq('auth_user_id', user.id)
        .order('area_id', { ascending: true });

      if (data && data.length > 0) {
        setConfigs(data);
        setSelectedConfig(data[0]);
        setExpandedDistrict(data[0].area_id.split('-').slice(0, 3).join('-'));
      }
      setLoading(false);
    }
    loadData();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) return <div style={{ padding: '40px' }}>Dashboard wird geladen...</div>;

  const mainDistricts = configs.filter(c => c.area_id.split('-').length <= 3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', backgroundColor: '#f8fafc' }}>
      <header style={dashboardHeaderStyle}>
        <div className="brand-header" style={{ margin: 0 }}>
          <img
            alt="Immobilienmarkt & Standortprofile"
            width={48}
            height={48}
            src="/logo/wohnlagencheck24.svg"
            className="brand-icon"
            style={{ display: 'block' }}
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
      <aside style={utilityBarStyle}>
        <div style={toolIconsGroupStyle}>
          <button
            onClick={() => setActiveMainTab('texts')}
            style={toolIconButtonStyle(activeMainTab === 'texts')}
            title="Berichte & Texte"
          >
            ✍️
          </button>
          <button
            onClick={() => setActiveMainTab('factors')}
            style={toolIconButtonStyle(activeMainTab === 'factors')}
            title="Preisfaktoren"
          >
            📊
          </button>
          <button
            onClick={() => setActiveMainTab('marketing')}
            style={toolIconButtonStyle(activeMainTab === 'marketing')}
            title="Online-Marketing"
          >
            📈
          </button>
          <button
            onClick={() => setActiveMainTab('local_site')}
            style={toolIconButtonStyle(activeMainTab === 'local_site')}
            title="Lokale Website"
          >
            🧭
          </button>
          <button
            onClick={() => setActiveMainTab('immobilien')}
            style={toolIconButtonStyle(activeMainTab === 'immobilien')}
            title="Immobilien"
          >
            🏠
          </button>
          <button
            onClick={() => setActiveMainTab('gesuche')}
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
            const subAreas = configs.filter(c => c.area_id.startsWith(district.area_id) && c.area_id.split('-').length > 3);

            return (
              <div key={district.id} style={{ marginBottom: '8px' }}>
                <button
                  onClick={() => {
                    setSelectedConfig(district);
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
                        key={ort.id}
                        onClick={() => setSelectedConfig(ort)}
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

      {/* 3. SPALTE: ARBEITSBEREICH (Rechts) */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '40px' }}>
        {selectedConfig ? (
          /* Hier entfernen wir das maxWidth: '1000px' damit die Formulare die Breite nutzen */
          <div style={{ width: '100%' }}>
            <header style={{ marginBottom: '30px' }}>
              <div style={breadcrumbStyle}>
                Regionen / {selectedConfig.area_id.split('-').length > 3 ? 'Ortslage' : 'Kreis'}
              </div>
              <h1 style={mainTitleStyle}>{selectedConfig.areas?.name}</h1>
            </header>

            {/* Die Forms nutzen nun die volle Breite des <main> Containers */}
            {activeMainTab === 'factors' ? (
              <FactorForm key={`f-${selectedConfig.id}`} config={selectedConfig} />
            ) : activeMainTab === 'texts' ? (
              <TextEditorForm key={`t-${selectedConfig.id}`} config={selectedConfig} />
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

const utilityBarStyle: React.CSSProperties = {
  width: '64px',
  backgroundColor: '#f0f0f0',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '20px 0',
  zIndex: 10
};

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

const breadcrumbStyle = {
  fontSize: '12px',
  color: '#94a3b8',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  marginBottom: '8px'
};

const cardStyle = {
  backgroundColor: '#fff',
  borderRadius: '16px',
  padding: '30px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  border: '1px solid #e2e8f0'
};

const emptyStateStyle = {
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#94a3b8'
};
