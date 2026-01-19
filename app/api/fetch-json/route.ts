// app/api/fetch-json/route.ts

import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: Request) {
  try {
    const { bundesland, kreis, ortslage } = await req.json();

    // Pfad-Logik basierend auf deiner Struktur
    // wohnlagencheck24/data/json/reports/deutschland/sachsen/leipzig.json
    // wohnlagencheck24/data/json/reports/deutschland/sachsen/leipzig/eutritzsch.json
    
    let filePath = path.join(process.cwd(), 'data', 'json', 'reports', 'deutschland', bundesland, `${kreis}.json`);
    
    if (ortslage) {
      filePath = path.join(process.cwd(), 'data', 'json', 'reports', 'deutschland', bundesland, kreis, `${ortslage}.json`);
    }

    const fileContent = await fs.readFile(filePath, 'utf8');
    const jsonData = JSON.parse(fileContent);

    return NextResponse.json(jsonData.text);
  } catch (error) {
    return NextResponse.json({ error: 'Datei nicht gefunden' }, { status: 404 });
  }
}