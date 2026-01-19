// app/api/ai-rewrite/route.ts


import { NextResponse } from 'next/server';

/**
 * KI-Veredelungs-Schnittstelle
 * Verarbeitet verschiedene Text-Typen mit spezifischen (simulierten) Prompts.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { text, areaName, type, sectionLabel } = body;

    // 1. Simulation der LLM-Rechenzeit
    await new Promise((resolve) => setTimeout(resolve, 1800));

    // 2. Logik-Weiche basierend auf dem Text-Typ
    let finalContent = "";

    if (type === 'data_driven') {
      // Simulation: Fakten bleiben exakt gleich, Stil wird flüssiger
      finalContent = `Der Immobilienmarkt in ${areaName} zeigt im Bereich "${sectionLabel}" eine klare Tendenz: ${text.replace('ist', 'präsentiert sich aktuell mit')} (Die statistischen Werte wurden präzise beibehalten).`;
    } 
    
    else if (type === 'general') {
      // Simulation: SEO-optimierter, werblicherer Text
      finalContent = `Entdecken Sie die Vorzüge von ${areaName}: ${text.substring(0, 50)}... Dieser Standort überzeugt durch eine exzellente Infrastruktur und hohe Lebensqualität, was sich direkt in der Marktentwicklung widerspiegelt.`;
    } 
    
    else {
      // Fallback oder 'individual' (falls KI dort genutzt wird)
      finalContent = `Optimierte Fassung für ${areaName}: ${text}`;
    }

    // 3. Strukturierte Rückgabe
    return NextResponse.json({ 
      optimizedText: `[KI-MODUS: ${type.toUpperCase()}]\n${finalContent}`
    });

  } catch (error: any) {
    console.error('AI Route Error:', error);
    return NextResponse.json({ error: 'Fehler in der KI-Schnittstelle' }, { status: 500 });
  }
}