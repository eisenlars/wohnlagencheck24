// app/dashboard/FactorForm.tsx

'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function FactorForm({ config }: { config: any }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [comment, setComment] = useState("");

  // States basierend auf deinen Datenbankvorgaben
  const [sf, setSf] = useState(config.standortfaktoren || {});
  const [trend, setTrend] = useState(config.immobilienmarkt_trend || {});
  const [kh, setKh] = useState(config.kauf_haus || {});
  const [kw, setKw] = useState(config.kauf_wohnung || {});
  const [kg, setKg] = useState(config.kauf_grundstueck || {});
  const [mh, setMh] = useState(config.miete_haus || {});
  const [mw, setMw] = useState(config.miete_wohnung || {});
  const [rendite, setRendite] = useState(config.rendite || {});

  const handleSave = async () => {
    setLoading(true);
    setMessage('');
    const { error } = await supabase
      .from('partner_area_config')
      .update({
        standortfaktoren: sf, immobilienmarkt_trend: trend,
        kauf_haus: kh, kauf_wohnung: kw, kauf_grundstueck: kg,
        miete_haus: mh, miete_wohnung: mw, rendite: rendite,
      })
      .eq('id', config.id);

    if (error) { setMessage('❌ Fehler: ' + error.message); }
    else { 
      setMessage('✅ Erfolgreich gespeichert!'); 
      setTimeout(() => setMessage(''), 4000);
    }
    setLoading(false);
  };

  const handleReset = () => {
    if (confirm("Möchten Sie alle Werte dieses Gebiets auf 1.0 zurücksetzen?")) {
      const reset = (obj: any) => {
        const n = { ...obj };
        Object.keys(n).forEach(k => n[k] = 1);
        return n;
      };
      setSf(reset(sf)); setTrend(reset(trend)); setKh(reset(kh));
      setKw(reset(kw)); setKg(reset(kg)); setMh(reset(mh));
      setMw(reset(mw)); setRendite(reset(rendite));
    }
  };

  // VERBESSERTE INPUT-ZEILE: Minus links, Wert Mitte, Plus rechts
  const InputRow = ({ label, value, onChange }: any) => {
    const isInherited = value === 1 || value === "1" || value === undefined;
    
    const adjust = (delta: number) => {
      const newVal = Math.round(((value || 1) + delta) * 10) / 10;
      if (newVal >= 0.1 && newVal <= 5.0) onChange(newVal);
    };

    return (
      <div style={{ marginBottom: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <span style={{ fontSize: '16px', fontWeight: '600', color: '#1a202c' }}>{label}</span>
            {isInherited && <span style={{ fontSize: '11px', color: '#a0aec0', fontWeight: 'bold' }}>STANDARD</span>}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <button onClick={() => adjust(-0.1)} style={stepButtonStyle}>−</button>
          
          <div style={{ 
            flex: 1, textAlign: 'center', padding: '12px', fontSize: '20px', fontWeight: 'bold',
            borderRadius: '8px', border: isInherited ? '2px solid #e2e8f0' : '2px solid #2b6cb0',
            backgroundColor: isInherited ? '#f8fafc' : '#ebf8ff',
            color: isInherited ? '#718096' : '#2b6cb0'
          }}>
            {(value || 1).toFixed(1)}
          </div>
          
          <button onClick={() => adjust(0.1)} style={stepButtonStyle}>+</button>
        </div>
      </div>
    );
  };

  const FactorGrid = ({ title, data, setter }: any) => (
    <div style={{ padding: '15px 0' }}>
      <h5 style={gridTitleStyle}>{title}</h5>
      {['f01', 'f02', 'f03', 'f04', 'f05', 'f06'].map(f => (
        <InputRow key={f} label={`Klasse ${f}`} value={data[f]} onChange={(v: any) => setter({...data, [f]: v})} />
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
      
      {/* 1. Markttrends */}
      <details open style={sectionStyle}>
        <summary style={summaryStyle}>📈 Markttrends & Basis</summary>
        <div style={gridStyle}>
          <InputRow label="Trend Immobilienmarkt" value={trend.immobilienmarkt} onChange={(v:any) => setTrend({...trend, immobilienmarkt: v})} />
          <InputRow label="Trend Mietmarkt" value={trend.mietmarkt} onChange={(v:any) => setTrend({...trend, mietmarkt: v})} />
        </div>
      </details>

      {/* 2. Kaufpreise */}
      <details style={sectionStyle}>
        <summary style={summaryStyle}>💰 Kaufpreis-Faktoren</summary>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '50px', padding: '25px 0' }}>
          <FactorGrid title="Häuser" data={kh} setter={setKh} />
          <FactorGrid title="Wohnungen" data={kw} setter={setKw} />
          <FactorGrid title="Grundstücke" data={kg} setter={setKg} />
        </div>
      </details>

      {/* 3. Mietpreise */}
      <details style={sectionStyle}>
        <summary style={summaryStyle}>🏠 Mietpreis-Faktoren</summary>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', padding: '25px 0' }}>
          <FactorGrid title="Miete Häuser" data={mh} setter={setMh} />
          <FactorGrid title="Miete Wohnungen" data={mw} setter={setMw} />
        </div>
      </details>

      {/* 4. Rendite */}
      <details style={sectionStyle}>
        <summary style={summaryStyle}>📊 Rendite & Indizes</summary>
        <div style={gridStyle}>
          <InputRow label="Mietrendite ETW" value={rendite.mietrendite_etw} onChange={(v:any) => setRendite({...rendite, mietrendite_etw: v})} />
          <InputRow label="Kaufpreisfaktor ETW" value={rendite.kaufpreisfaktor_etw} onChange={(v:any) => setRendite({...rendite, kaufpreisfaktor_etw: v})} />
          <InputRow label="Mietrendite EFH" value={rendite.mietrendite_efh} onChange={(v:any) => setRendite({...rendite, mietrendite_efh: v})} />
          <InputRow label="Kaufpreisfaktor EFH" value={rendite.kaufpreisfaktor_efh} onChange={(v:any) => setRendite({...rendite, kaufpreisfaktor_efh: v})} />
          <InputRow label="Mietrendite MFH" value={rendite.mietrendite_mfh} onChange={(v:any) => setRendite({...rendite, mietrendite_mfh: v})} />
          <InputRow label="Kaufpreisfaktor MFH" value={rendite.kaufpreisfaktor_mfh} onChange={(v:any) => setRendite({...rendite, kaufpreisfaktor_mfh: v})} />
        </div>
      </details>

      {/* 5. Standortfaktoren */}
      <details style={sectionStyle}>
        <summary style={summaryStyle}>📍 Standortbewertung</summary>
        <div style={gridStyle}>
          {Object.keys(sf).map(key => (
            <InputRow key={key} label={key.charAt(0).toUpperCase() + key.slice(1)} value={sf[key]} onChange={(v:any) => setSf({...sf, [key]: v})} />
          ))}
        </div>
      </details>

      {/* Kommentar & Footer */}
      <div style={{ marginTop: '20px' }}>
        <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#4a5568' }}>Warum wurden diese Änderungen vorgenommen? (Optional)</label>
        <textarea 
          value={comment} onChange={(e) => setComment(e.target.value)}
          style={textareaStyle} placeholder="Ihre Begründung für die Redaktion..."
        />
      </div>

      <div style={footerStyle}>
        <button onClick={handleReset} style={resetButtonStyle}>🔄 Zurücksetzen</button>
        <div style={{ flex: 1 }}></div>
        {message && <span style={{ fontWeight: 'bold', fontSize: '18px', color: '#2f855a' }}>{message}</span>}
        <button onClick={handleSave} disabled={loading} style={saveButtonStyle(loading)}>
          {loading ? 'Läuft...' : '💾 Jetzt live schalten'}
        </button>
      </div>
    </div>
  );
}

// --- STYLES FÜR GROSSE DARSTELLUNG ---

const sectionStyle = {
  backgroundColor: '#fff', border: '1px solid #cbd5e0', borderRadius: '15px',
  padding: '15px 25px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
};

const summaryStyle = {
  fontWeight: '800', fontSize: '19px', color: '#2d3748', cursor: 'pointer', outline: 'none', padding: '10px 0'
};

const gridStyle = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', padding: '25px 0'
};

const gridTitleStyle = {
  borderBottom: '3px solid #2d3748', marginBottom: '20px', paddingBottom: '8px', 
  color: '#2d3748', fontSize: '15px', textTransform: 'uppercase' as const, letterSpacing: '1px'
};

const stepButtonStyle = {
  width: '50px', height: '50px', backgroundColor: '#edf2f7', border: 'none', 
  borderRadius: '8px', fontSize: '24px', fontWeight: 'bold', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2d3748'
};

const textareaStyle = {
  width: '100%', minHeight: '100px', padding: '15px', borderRadius: '10px', 
  border: '2px solid #cbd5e0', marginTop: '10px', fontSize: '16px', fontFamily: 'inherit'
};

const footerStyle = {
  marginTop: '30px', padding: '30px', borderTop: '2px solid #e2e8f0', 
  display: 'flex', alignItems: 'center', gap: '20px', backgroundColor: '#f7fafc', borderRadius: '15px'
};

const saveButtonStyle = (loading: boolean) => ({
  padding: '18px 40px', backgroundColor: loading ? '#cbd5e0' : '#2b6cb0',
  color: '#fff', border: 'none', borderRadius: '12px', fontSize: '18px', fontWeight: '800', cursor: 'pointer'
});

const resetButtonStyle = {
  padding: '15px 25px', backgroundColor: 'transparent', color: '#e53e3e',
  border: '2px solid #feb2b2', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: 'pointer'
};