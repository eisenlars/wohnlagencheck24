import { getAllOrte, getOrtBySlug } from "@/lib/data";
import type { Metadata } from "next";
import Link from "next/link";

type Params = {
  slug: string;
};

export async function generateStaticParams() {
  const orte = getAllOrte();
  return orte.map((ort) => ({ slug: ort.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const ort = getOrtBySlug(slug);

  if (!ort) {
    return {
      title: "Ort nicht gefunden – Wohnlagencheck24",
      description: "Die angefragte Wohnlage konnte nicht gefunden werden.",
    };
  }

  const title = `${ort.name} – Wohnlage im Landkreis ${ort.landkreis}`;
  const description = ort.kurzbeschreibung;
  const url = `/ort/${ort.slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      locale: "de_DE",
    },
  };
}

export default async function OrtPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const ort = getOrtBySlug(slug);

  if (!ort) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold mb-4">Ort nicht gefunden</h1>
        <p className="mb-4">
          Die angefragte Wohnlage konnte nicht gefunden werden. Bitte prüfen
          Sie die URL.
        </p>
        <Link href="/" className="text-blue-600 underline">
          Zur Startseite
        </Link>
      </main>
    );
  }

  // --- JSON-LD-Blöcke für LLMs & Google ---

  const baseUrl = "https://www.wohnlagencheck24.de"; // später anpassen

  const placeLd = {
    "@type": "Place",
    name: ort.name,
    address: {
      "@type": "PostalAddress",
      addressLocality: ort.name,
      postalCode: ort.plz,
      addressRegion: ort.landkreis,
      addressCountry: "DE",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: ort.lat,
      longitude: ort.lng,
    },
  };

  const webPageLd = {
    "@type": "WebPage",
    name: `${ort.name} – Wohnlage im Landkreis ${ort.landkreis}`,
    description: ort.kurzbeschreibung,
    url: `${baseUrl}/ort/${ort.slug}`,
  };

  const breadcrumbLd = {
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Startseite",
        item: `${baseUrl}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: `Wohnlagen Landkreis ${ort.landkreis}`,
        item: `${baseUrl}/landkreis/${encodeURIComponent(
          ort.landkreis.toLowerCase().replace(/\s+/g, "-")
        )}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: ort.name,
        item: `${baseUrl}/ort/${ort.slug}`,
      },
    ],
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [webPageLd, placeLd, breadcrumbLd],
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      {/* JSON-LD für LLMs & Suchmaschinen */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb-Navigation (auch für Crawler hilfreich) */}
      <nav className="text-sm text-gray-500 mb-4" aria-label="Breadcrumb">
        <ol className="flex flex-wrap gap-1">
          <li>
            <Link href="/" className="hover:underline">
              Startseite
            </Link>{" "}
            /
          </li>
          <li>
            <Link
              href={`/landkreis/${ort.landkreis
                .toLowerCase()
                .replace(/\s+/g, "-")}`}
              className="hover:underline"
            >
              Landkreis {ort.landkreis}
            </Link>{" "}
            /
          </li>
          <li aria-current="page" className="font-semibold">
            {ort.name}
          </li>
        </ol>
      </nav>

      {/* H1 = Hauptthema der Seite */}
      <h1 className="text-3xl font-bold mb-2">
        {ort.name} – Wohnlage im Landkreis {ort.landkreis}
      </h1>

      <p className="text-gray-600 mb-6">
        {ort.bundesland} · PLZ {ort.plz}
      </p>

      {/* Kleine Inhaltsübersicht – hilft Nutzern & LLMs */}
      <nav className="mb-8 border border-gray-200 rounded-lg p-4 bg-gray-50">
        <h2 className="text-lg font-semibold mb-2">Inhaltsübersicht</h2>
        <ul className="list-disc list-inside text-sm space-y-1">
          <li>
            <a href="#charakter" className="text-blue-600 hover:underline">
              Charakter & Lage
            </a>
          </li>
          <li>
            <a href="#markt" className="text-blue-600 hover:underline">
              Wohnmarktsituation
            </a>
          </li>
          <li>
            <a href="#infrastruktur" className="text-blue-600 hover:underline">
              Infrastruktur & Erreichbarkeit
            </a>
          </li>
          <li>
            <a href="#geodaten" className="text-blue-600 hover:underline">
              Geodaten
            </a>
          </li>
        </ul>
      </nav>

      {/* Abschnitt: Charakter & Lage */}
      <section id="charakter" className="mb-8">
        <h2 className="text-2xl font-semibold mb-2">
          Charakter & Lage von {ort.name}
        </h2>
        <p className="mb-3">{ort.beschreibung}</p>
        <p className="text-sm text-gray-600">
          Hinweis: Diese Beschreibung kann später automatisiert aus deinen
          Analyse-Daten (Wohnlage, Struktur, Historie) generiert und erweitert
          werden.
        </p>
      </section>

      {/* Abschnitt: Wohnmarktsituation – aktuell Platzhalter */}
      <section id="markt" className="mb-8">
        <h2 className="text-2xl font-semibold mb-2">
          Wohnmarktsituation in {ort.name}
        </h2>
        <p>
          Hier können später Kennzahlen zu Mieten, Kaufpreisen,
          Marktanspannung, Leerstandsquoten und weiteren Indikatoren aus deiner
          Pipeline integriert werden.
        </p>
      </section>

      {/* Abschnitt: Infrastruktur – aktuell Platzhalter */}
      <section id="infrastruktur" className="mb-8">
        <h2 className="text-2xl font-semibold mb-2">
          Infrastruktur & Erreichbarkeit
        </h2>
        <p>
          In diesem Abschnitt kannst du Informationen zu Verkehrsanbindung,
          Nahversorgung, Schulen, Kitas und Freizeitangeboten ergänzen.
        </p>
      </section>

      {/* Abschnitt: Geodaten */}
      <section id="geodaten" className="mb-8">
        <h2 className="text-2xl font-semibold mb-2">Geodaten</h2>
        <p>Latitude: {ort.lat}</p>
        <p>Longitude: {ort.lng}</p>
      </section>
    </main>
  );
}
