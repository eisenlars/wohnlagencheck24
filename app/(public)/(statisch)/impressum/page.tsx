import { loadPortalCmsEntriesByPage, resolvePortalCmsField } from "@/lib/portal-cms-reader";

function renderParagraphs(text: string, className = "mb-0") {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, index) => (
      <p key={`${className}-${index}`} className={className}>
        {block.split("\n").map((line, lineIndex) => (
          <span key={`${className}-${index}-${lineIndex}`}>
            {line}
            {lineIndex < block.split("\n").length - 1 ? <br /> : null}
          </span>
        ))}
      </p>
    ));
}

function FallbackImpressumPage() {
  return (
    <div className="container py-4 text-dark">
      <h1 className="h2 mb-4">Impressum</h1>

      <section className="mb-4">
        <h2 className="h5">ANGABEN GEMASS §5 TMG:</h2>
        <p className="mb-0">wohnlagencheck24 UG (haftungsbeschrankt)</p>
        <p className="mb-0">Racknitzhohe 35A</p>
        <p className="mb-0">01217 Dresden</p>
        <p className="mb-0 mt-3">Handelsregister: in Grundung beantragt</p>
        <p className="mb-0">Registergericht: Amtsgericht Dresden</p>
        <p className="mb-0 mt-3">Vertreten durch die Geschaftsfuhrer:</p>
        <p className="mb-0">Christopher Kossack</p>
      </section>

      <section className="mb-4">
        <h2 className="h5">KONTAKT</h2>
        <p className="mb-0">Telefon: 0351 / 28 70 51 - 0</p>
        <p className="mb-0">Telefax: 0351 / 28 70 51 - 90</p>
        <p className="mb-0">E-Mail: info@praxiswissen-immobilien.de</p>
        <p className="mb-0">E-Mail: info@wohnlagencheck24.de</p>
      </section>

      <section className="mb-4">
        <h2 className="h5">UMSATZSTEUER-ID</h2>
        <p className="mb-0">
          Umsatzsteuer-Identifikationsnummer gemaß §27 a Umsatzsteuergesetz
        </p>
        <p className="mb-0">in Grundung beantragt</p>
      </section>

      <section className="mb-4">
        <p className="mb-0">
          Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </section>

      <section className="mb-4">
        <h2 className="h5">HAFTUNG FUR INHALTE</h2>
        <p>
          Als Diensteanbieter sind wir gemaß § 7 Abs.1 TMG fur eigene Inhalte auf diesen Seiten nach den allgemeinen
          Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet,
          ubermittelte oder gespeicherte fremde Informationen zu uberwachen oder nach Umstanden zu forschen, die auf
          eine rechtswidrige Tatigkeit hinweisen.
        </p>
        <p>
          Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen
          bleiben hiervon unberuhrt. Eine diesbezugliche Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer
          konkreten Rechtsverletzung moglich. Bei Bekanntwerden von entsprechenden Rechtsverletzungen werden wir diese
          Inhalte umgehend entfernen.
        </p>
      </section>

      <section className="mb-4">
        <h2 className="h5">HAFTUNG FUR LINKS</h2>
        <p>
          Unser Angebot enthalt Links zu externen Webseiten Dritter, auf deren Inhalte wir keinen Einfluss haben.
          Deshalb konnen wir fur diese fremden Inhalte auch keine Gewahr ubernehmen. Fur die Inhalte der verlinkten
          Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich. Die verlinkten Seiten
          wurden zum Zeitpunkt der Verlinkung auf mogliche Rechtsverstoße uberpruft. Rechtswidrige Inhalte waren zum
          Zeitpunkt der Verlinkung nicht erkennbar.
        </p>
        <p>
          Eine permanente inhaltliche Kontrolle der verlinkten Seiten ist jedoch ohne konkrete Anhaltspunkte einer
          Rechtsverletzung nicht zumutbar. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Links
          umgehend entfernen.
        </p>
      </section>

      <section>
        <h2 className="h5">URHEBERRECHT</h2>
        <p>
          Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen
          Urheberrecht. Die Vervielfaltigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der
          Grenzen des Urheberrechtes bedurfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
          Downloads und Kopien dieser Seite sind nur fur den privaten, nicht kommerziellen Gebrauch gestattet.
        </p>
        <p>
          Soweit die Inhalte auf dieser Seite nicht vom Betreiber erstellt wurden, werden die Urheberrechte Dritter
          beachtet. Insbesondere werden Inhalte Dritter als solche gekennzeichnet. Sollten Sie trotzdem auf eine
          Urheberrechtsverletzung aufmerksam werden, bitten wir um einen entsprechenden Hinweis. Bei Bekanntwerden von
          Rechtsverletzungen werden wir derartige Inhalte umgehend entfernen.
        </p>
      </section>
    </div>
  );
}

export async function ImpressumPageContent({ locale = "de" }: { locale?: string }) {
  const entries = await loadPortalCmsEntriesByPage("impressum", locale);
  const companyBlock = resolvePortalCmsField(entries, "impressum_main", "company_block", "");
  const contactBlock = resolvePortalCmsField(entries, "impressum_main", "contact_block", "");
  const legalBlock = resolvePortalCmsField(entries, "impressum_main", "legal_block", "");
  const hasCmsContent = Boolean(companyBlock || contactBlock || legalBlock);

  if (!hasCmsContent) {
    return <FallbackImpressumPage />;
  }

  return (
    <div className="container py-4 text-dark">
      <h1 className="h2 mb-4">{resolvePortalCmsField(entries, "impressum_main", "headline", "Impressum")}</h1>

      {companyBlock ? (
        <section className="mb-4">
          <h2 className="h5">ANGABEN GEMASS §5 TMG</h2>
          {renderParagraphs(companyBlock)}
        </section>
      ) : null}

      {contactBlock ? (
        <section className="mb-4">
          <h2 className="h5">KONTAKT</h2>
          {renderParagraphs(contactBlock)}
        </section>
      ) : null}

      {legalBlock ? (
        <section className="mb-4">
          <h2 className="h5">RECHTLICHE HINWEISE</h2>
          {renderParagraphs(legalBlock, "mb-3")}
        </section>
      ) : null}
    </div>
  );
}

export default async function ImpressumPage() {
  return <ImpressumPageContent locale="de" />;
}
