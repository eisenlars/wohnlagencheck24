'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import FactorForm from './FactorForm'; 
import TextEditorForm from './TextEditorForm'; 

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const [configs, setConfigs] = useState<any[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<any>(null);
  const [expandedDistrict, setExpandedDistrict] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Werkzeug-Modus umschalten
  const [activeMainTab, setActiveMainTab] = useState<'factors' | 'texts' | 'ads'>('factors');

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data } = await supabase
        .from('partner_area_config')
        .select(`*, areas!inner ( name, id )`)
        .eq('partner_id', user.id)
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

  if (loading) return <div style={{ padding: '40px' }}>Dashboard wird geladen...</div>;

  const mainDistricts = configs.filter(c => c.area_id.split('-').length <= 3);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', backgroundColor: '#f8fafc' }}>
      
      {/* 1. SPALTE: WERKZEUGE (Ganz links, schmal) */}
      <aside style={utilityBarStyle}>
        <div style={logoContainerStyle}>W</div>
        
        <div style={toolIconsGroupStyle}>
          <button 
            onClick={() => setActiveMainTab('factors')} 
            style={toolIconButtonStyle(activeMainTab === 'factors')}
            title="Preisfaktoren"
          >
            📊
          </button>
          <button 
            onClick={() => setActiveMainTab('texts')} 
            style={toolIconButtonStyle(activeMainTab === 'texts')}
            title="Berichte & Texte"
          >
            ✍️
          </button>
          <button 
            style={toolIconButtonStyle(false, true)} 
            disabled 
            title="Werbung (In Kürze)"
          >
            📢
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
            ) : (
                <TextEditorForm key={`t-${selectedConfig.id}`} config={selectedConfig} />
            )}
          </div>
        ) : (
          <div style={emptyStateStyle}>Wählen Sie eine Region aus der mittleren Spalte.</div>
        )}
      </main>
    </div>
  );
}

// --- STYLES ---

const utilityBarStyle: React.CSSProperties = {
  width: '64px',
  backgroundColor: '#0f172a',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '20px 0',
  zIndex: 10
};

const logoContainerStyle = {
  width: '40px',
  height: '40px',
  backgroundColor: '#3b82f6',
  borderRadius: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'white',
  fontWeight: '900',
  marginBottom: '40px'
};

const toolIconsGroupStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '16px'
};

const toolIconButtonStyle = (active: boolean, disabled = false) => ({
  width: '44px',
  height: '44px',
  borderRadius: '12px',
  border: 'none',
  backgroundColor: active ? '#3b82f6' : 'transparent',
  fontSize: '20px',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.3 : 1,
  transition: 'all 0.2s',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
});

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