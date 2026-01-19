// features/valuation/components/ValuationWizard.tsx

"use client";

import { useState } from "react";

interface ValuationWizardProps {
  ctx?: any;
  basePrice?: number;
  level: 'kreis' | 'ort' | 'global';
}

// WICHTIG: Named Export passend zu deinem Import { ValuationWizard }
export function ValuationWizard({ ctx, basePrice, level }: ValuationWizardProps) {
  const [step, setStep] = useState(1);
  const [street, setStreet] = useState("");

  return (
    <div className="card border-0 shadow-lg text-dark overflow-hidden">
      <div className="card-header bg-warning py-2 border-0">
        <div className="progress" style={{ height: "4px" }}>
          <div className="progress-bar bg-dark" style={{ width: `${(step / 3) * 100}%` }}></div>
        </div>
      </div>
      <div className="card-body p-4 p-md-5">
        {step === 1 && (
          <div className="animate-fade-in">
            <h4 className="fw-bold mb-4">Adresse in {ctx?.ortSlug || ctx?.kreisSlug || "der Region"}</h4>
            <div className="form-floating mb-3">
              <input 
                type="text" 
                className="form-control" 
                id="addr" 
                placeholder="Straße"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
              />
              <label htmlFor="addr">Straße & Hausnummer</label>
            </div>
            <button 
              className="btn btn-primary w-100 py-3 fw-bold" 
              onClick={() => setStep(2)}
              disabled={!street}
            >
              Straße analysieren
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in text-center py-4">
             <div className="spinner-border text-primary mb-3" role="status"></div>
             <h5>Analysiere Mikrolage für {street}...</h5>
             <p className="text-muted small">Abgleich mit Zensus-Gitterzellen & Preis-Polygonen</p>
             {/* Simulation für den nächsten Schritt */}
             <button className="btn btn-outline-secondary btn-sm mt-3" onClick={() => setStep(3)}>
               Weiter zur Ausstattung
             </button>
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade-in">
            <h4 className="fw-bold mb-2">Fast fertig!</h4>
            <p className="text-muted mb-4">Basispreis: {basePrice || "---"} €/m²</p>
            <div className="form-floating mb-3">
              <textarea className="form-control" style={{height: '100px'}} placeholder="Features"></textarea>
              <label>Besonderheiten (KI-Analyse)</label>
            </div>
            <button className="btn btn-success w-100 py-3 fw-bold" onClick={() => alert("Analyse startet...")}>
              Ergebnis berechnen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}