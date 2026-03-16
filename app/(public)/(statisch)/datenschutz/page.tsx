import { loadPortalCmsEntriesByPage, resolvePortalCmsField } from "@/lib/portal-cms-reader";

function renderPrivacyParagraphs(text: string, className = "mb-3") {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, index) => (
      <p key={`${className}-${index}`} className={className}>
        {block.split("\n").map((line, lineIndex, lines) => (
          <span key={`${className}-${index}-${lineIndex}`}>
            {line}
            {lineIndex < lines.length - 1 ? <br /> : null}
          </span>
        ))}
      </p>
    ));
}

export default async function DatenschutzPage() {
  const entries = await loadPortalCmsEntriesByPage("datenschutz", "de");
  const intro = resolvePortalCmsField(entries, "privacy_intro", "intro", "");
  const responsibleParty = resolvePortalCmsField(entries, "privacy_intro", "responsible_party", "");
  const collection = resolvePortalCmsField(entries, "privacy_collection", "body", "");
  const tools = resolvePortalCmsField(entries, "privacy_tools", "body", "");
  const rights = resolvePortalCmsField(entries, "privacy_rights", "body", "");
  const hasCmsContent = Boolean(intro || responsibleParty || collection || tools || rights);

  if (hasCmsContent) {
    return (
      <div className="container py-4 text-dark">
        <h1 className="h2 mb-4">{resolvePortalCmsField(entries, "privacy_intro", "headline", "Datenschutz")}</h1>

        {intro ? <section className="mb-4">{renderPrivacyParagraphs(intro)}</section> : null}

        {responsibleParty ? (
          <section className="mb-4">
            <h2 className="h5">Verantwortliche Stelle</h2>
            {renderPrivacyParagraphs(responsibleParty)}
          </section>
        ) : null}

        {collection ? (
          <section className="mb-4">
            <h2 className="h5">Erhebung und Verarbeitung</h2>
            {renderPrivacyParagraphs(collection)}
          </section>
        ) : null}

        {tools ? (
          <section className="mb-4">
            <h2 className="h5">Tools und Dienste</h2>
            {renderPrivacyParagraphs(tools)}
          </section>
        ) : null}

        {rights ? (
          <section className="mb-4">
            <h2 className="h5">Rechte und Kontakt</h2>
            {renderPrivacyParagraphs(rights)}
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="container py-4 text-dark">
      <h1 className="h2 mb-4">Datenschutz</h1>

      <p>
        Die Betreiber dieser Seiten nehmen den Schutz Ihrer personlichen Daten sehr ernst. Wir behandeln Ihre
        personenbezogenen Daten entsprechend dieser Datenschutzerklarung gemaß den gesetzlichen
        Datenschutzvorschriften.
      </p>

      <section className="mb-4">
        <h2 className="h5">1. Name und Kontaktdaten des fur die Verarbeitung Verantwortlichen</h2>
        <p>
          Diese Datenschutzerklarung gilt fur die Datenverarbeitung bei Besuch der Homepage
          www.praxiswissen-immobilien.de, betrieben von wohnlagencheck24 UG (haftungsbeschrankt), Vertreten durch den
          Geschaftsfuhrer Christopher Kossack (im Folgenden: wohnlagencheck24), Racknitzhohe 35A, 01217 Dresden,
          Deutschland, E-Mail: info[at]wohnlagencheck24[dot]de, Tel.: 0351 / 28 70 51 - 0, Fax: 0351 / 28 70 51 - 90.
        </p>
      </section>

      <section className="mb-4">
        <h2 className="h5">2. Erhebung und Speicherung personenbezogener Daten sowie Art und Zweck von deren Verwendung</h2>
        <p>
          Die Nutzung unserer Webseite ist in der Regel ohne Angabe personenbezogener Daten moglich. Soweit auf
          unseren Seiten personenbezogene Daten (beispielsweise Name, Anschrift oder E-Mail-Adressen) erhoben werden,
          erfolgt dies, soweit moglich, stets auf freiwilliger Basis. Diese Daten werden ohne Ihre ausdruckliche
          Zustimmung nicht an Dritte weitergegeben.
        </p>
        <p>
          Wir weisen darauf hin, dass die Datenubertragung im Internet (z.B. bei der Kommunikation per E-Mail)
          Sicherheitslucken aufweisen kann. Ein luckenloser Schutz der Daten vor dem Zugriff durch Dritte ist nicht
          moglich. Es werden aber die entsprechenden Maßnahmen fur die Datensicherheit getroffen (siehe dazu Punkt 10
          zur Datensicherheit).
        </p>
      </section>

      <section className="mb-4">
        <h2 className="h5">3. Datenschutzerklarung fur die Nutzung von Google Analytics</h2>
        <p>
          Diese Website nutzt Funktionen des Webanalysedienstes Google Analytics. Anbieter ist die Google Inc., 1600
          Amphitheatre Parkway Mountain View, CA 94043, USA.
        </p>
        <h3 className="h6">3.1. Funktion von Google Analytics</h3>
        <p>
          Google Analytics verwendet sog. &quot;Cookies&quot;. Das sind Textdateien, die auf Ihrem Computer gespeichert werden
          und die eine Analyse der Benutzung der Website durch Sie ermoglichen. Die durch den Cookie erzeugten
          Informationen uber Ihre Benutzung dieser Website werden in der Regel an einen Server von Google in den USA
          ubertragen und dort gespeichert. Mehr Informationen zum Umgang mit Nutzerdaten bei Google Analytics finden
          Sie in der Datenschutzerklarung von Google.
        </p>
        <h3 className="h6">3.2. Browser Plugin</h3>
        <p>
          Sie konnen die Speicherung der Cookies durch eine entsprechende Einstellung Ihrer Browser-Software
          verhindern; wir weisen Sie jedoch darauf hin, dass Sie in diesem Fall gegebenenfalls nicht samtliche
          Funktionen dieser Website vollumfanglich werden nutzen konnen. Sie konnen daruber hinaus die Erfassung der
          durch das Cookie erzeugten und auf Ihre Nutzung der Website bezogenen Daten (inkl. Ihrer IP-Adresse) an
          Google sowie die Verarbeitung dieser Daten durch Google verhindern, indem sie das unter dem folgenden Link
          verfugbare Browser-Plugin herunterladen und installieren.
        </p>
        <h3 className="h6">3.3. Widerspruch gegen Datenerfassung</h3>
        <p>
          Sie konnen die Erfassung Ihrer Daten durch Google Analytics verhindern, indem Sie auf folgenden Link klicken.
          Es wird ein Opt-Out-Cookie gesetzt, dass das Erfassung Ihrer Daten bei zukunftigen Besuchen dieser Website
          verhindert: Google Analytics deaktivieren.
        </p>
        <h3 className="h6">3.4. Auftragsdatenverarbeitung</h3>
        <p>
          Wir haben mit Google einen Vertrag zur Auftragsdatenverarbeitung abgeschlossen und setzen die strengen
          Vorgaben der deutschen Datenschutzbehorden bei der Nutzung von Google Analytics vollstandig um.
        </p>
        <h3 className="h6">3.5. IP-Anonymisierung</h3>
        <p>
          Wir nutzen die Funktion &quot;Aktivierung der IP-Anonymisierung&quot; auf dieser Webseite. Dadurch wird Ihre
          IP-Adresse von Google jedoch innerhalb von Mitgliedstaaten der Europaischen Union oder in anderen
          Vertragsstaaten des Abkommens uber den Europaischen Wirtschaftsraum zuvor gekurzt. Nur in Ausnahmefallen
          wird die volle IP-Adresse an einen Server von Google in den USA ubertragen und dort gekurzt. Im Auftrag des
          Betreibers dieser Website wird Google diese Informationen benutzen, um Ihre Nutzung der Website auszuwerten,
          um Reports uber die Websiteaktivitaten zusammenzustellen und um weitere mit der Websitenutzung und der
          Internetnutzung verbundene Dienstleistungen gegenuber dem Websitebetreiber zu erbringen. Die im Rahmen von
          Google Analytics von Ihrem Browser ubermittelte IP-Adresse wird nicht mit anderen Daten von Google
          zusammengefuhrt.
        </p>
      </section>

      <section className="mb-4">
        <h2 className="h5">4. Cookies</h2>
        <p>
          Die Internetseiten verwenden teilweise so genannte Cookies. Cookies richten auf Ihrem Rechner keinen Schaden
          an und enthalten keine Viren. Cookies dienen dazu, unser Angebot nutzerfreundlicher, effektiver und sicherer
          zu machen. Cookies sind kleine Textdateien, die auf Ihrem Rechner abgelegt werden und die Ihr Browser
          speichert. Die meisten der von uns verwendeten Cookies sind so genannte Session-Cookies. Sie werden nach Ende
          Ihres Besuchs automatisch geloscht. Andere Cookies bleiben auf Ihrem Endgerat gespeichert, bis Sie diese
          loschen. Diese Cookies ermoglichen es uns, Ihren Browser beim nachsten Besuch wiederzuerkennen.
        </p>
        <p>
          Die durch Cookies verarbeiteten Daten sind fur die genannten Zwecke zur Wahrung unserer berechtigten
          Interessen sowie der Dritter nach Art. 6 Abs. 1 S. 1 lit. f EuDSGVO erforderlich.
        </p>
        <p>
          Sie konnen Ihren Browser so einstellen, dass Sie uber das Setzen von Cookies informiert werden und Cookies nur
          im Einzelfall erlauben, die Annahme von Cookies fur bestimmte Falle oder generell ausschlie0en sowie das
          automatische Loschen der Cookies beim Schlie0en des Browser aktivieren. Bei der Deaktivierung von Cookies kann
          die Funktionalitat dieser Website eingeschrankt sein.
        </p>
      </section>

      <section className="mb-4">
        <h2 className="h5">5. Marketing Automation mit Mautic</h2>
        <p>
          Wir setzen auf dieser Website Mautic als Open-Source Werkzeug zur Marketing Automatisierung ein. Dies ist ein
          Tool zur zeitgerechten Ausgabe von passgenauen Informationen auf Basis der Erfassung und Analyse von
          Nutzungsdaten (u.a. verwendeter Browser, zuletzt besuchte Seite, Dauer des Aufenthaltes).
        </p>
        <p>
          Mautic wird durch uns auf eigens betriebenen Servern gehostet. Eine Weitergabe der Daten an Dritte findet
          nicht statt. Wir erfassen und verarbeiten Daten mit Mautic nur insoweit, wie fur die Erreichung der
          geschaftlichen Ziele sinnvoll und erforderlich ist.
        </p>
        <p>Unsere Mautic-Nutzung kann (muss aber nicht) umfassen:</p>
        <p className="mb-1">a) Maßgeschneidert Website-Inhalte</p>
        <p>
          Wir versuchen Ihre Interessen aufgrund der o.g. Nutzungsdaten bestmoglich einzuschatzen und Ihnen auf dieser
          Basis moglichst relevante Website-Inhalte im TYPO3 zu prasentieren (Targeting).
        </p>
        <p className="mb-1">b) E-Mail-Marketing und Kampagnen</p>
        <p>
          Beim sog. E-Mail-Marketing werden Ihnen personalisierte E-Mails zugesandt. Diese basieren z.T. auf dem
          Nutzungsverhalten auf unseren Websites beim Lesen unserer E-Mails und beim Interagieren mit den darin
          enthaltenen Links. Des Weiteren versenden wir E-Mails auch im Rahmen von Kampagnen. Dem Versand soclher
          E-Mails liegt immer eine gesonderte Zustimmung zu Grunde.
        </p>
        <p className="mb-1">c) Landingpages</p>
        <p>
          Landingpages sind spezielle Webseiten, die als Ziel von Werbekampagnen definiert wurden. Sie enthalten meist
          Interaktionsmoglichkeiten, z.B. zum Download von Whitepapers oder Checklisten und Formulare zur Erfassung von
          Interessenten-Informationen. Fur die Zuordnung der Einzelaktivitaten zu anonymen Profilen bzw. – mit
          vorheriger Einwilligung – zu den Profilen einzelner Nutzer nutzt die Software verschiedene technische
          Verfahren.
        </p>
        <p className="mb-1">d) Zahlpixel</p>
        <p>
          Um zu erkennen, ob z.B. eine E-Mail geoffnet wurde, setzt Mautic sogenannte Zahlpixel (Tracking Pixel) ein.
          Durch diese wird eine kleine Grafik vom Server des Anbieters geladen, die zuvor einem individuellen
          Nutzerprofil zugeordnet wurde.
        </p>
        <p className="mb-1">e) Personalisierte Weblinks</p>
        <p>
          Um zu erkennen, ob z.B. ein Nutzer einen Link aus einer E-Mail aufruft, fugt mautic diesen Links eine
          eindeutige Kennung hinzu, die zuvor einem individuellen Nutzerprofil zugeordnet wurde.
        </p>
        <p>Bei den dabei erhobenen Daten handelt es sich um:</p>
        <ul>
          <li>die Aktivitat auf unserer Website</li>
          <li>Anzahl der Seitenaufrufe und Verweildauer des Webseiten Besuchers</li>
          <li>der Klickpfad des jeweiligen Besuchers</li>
          <li>Downloads von Dateien die uber die Webseite bereitgestellt werden</li>
          <li>Besuche von Landingpages</li>
          <li>Offnungen von E-Mails aus Newsletter und Kampagnen</li>
        </ul>
        <p>
          Die von Webseitenbesuchern aktuell genutzte IP Adresse wird bei jedem Aufruf unserer Webseite an uns
          ubertragen. Mautic speichert diese nur anonymisiert.
        </p>
        <p>
          Mautic wird nur dann peronalisierbar eingesetzt, wenn Sie dem explizit zugestimmt haben. Sie konnen diese
          Einwilligung jederzeit gegenuber dem von uns oben genannten Ansprechpartner widerrufen. In diesem Fall werden
          alle mittels mautic erhobenen Trackingdaten unverzuglich geloscht.
        </p>
      </section>

      <section className="mb-4">
        <h2 className="h5">6. Server-Log-Files</h2>
        <p>
          Der Provider der Seiten erhebt und speichert automatisch Informationen temporar in so genannten Server-Log
          Files, die Ihr Browser automatisch an uns ubermittelt. Folgende Informationen werden dabei ohne Ihr Zutun
          erfasst und bis zur automatisierten Loschung gespeichert:
        </p>
        <ul>
          <li>Browsertyp/ Browserversion</li>
          <li>verwendetes Betriebssystem</li>
          <li>Referrer URL</li>
          <li>Hostname des zugreifenden Rechners</li>
          <li>Uhrzeit der Serveranfrage</li>
        </ul>
        <p>Die genannten Daten werden durch uns zu folgenden Zwecken verarbeitet:</p>
        <ul>
          <li>Gewahrleistung eines reibungslosen Verbindungsaufbaus der Website,</li>
          <li>Gewahrleistung einer komfortablen Nutzung unserer Website,</li>
          <li>Auswertung der Systemsicherheit und -stabilitat sowie</li>
          <li>zu weiteren administrativen Zwecken.</li>
        </ul>
      </section>

      <section className="mb-4">
        <h2 className="h5">7. Weitergabe von Daten</h2>
        <p>
          Eine Ubermittlung Ihrer personlichen Daten an Dritte zu anderen als den im Folgenden aufgefuhrten Zwecken
          findet nicht statt. Wir geben Ihre personlichen Daten nur an Dritte weiter, wenn:
        </p>
        <ul>
          <li>Sie Ihre nach Art. 6 Abs. 1 S. 1 lit. a EuDSGVO ausdruckliche Einwilligung dazu erteilt haben,</li>
          <li>
            die Weitergabe nach Art. 6 Abs. 1 S. 1 lit. f EuDSGVO zur Geltendmachung, Ausubung oder Verteidigung von
            Rechtsanspruchen erforderlich ist und kein Grund zur Annahme besteht, dass Sie ein uberwiegendes
            schutzwurdiges Interesse an der Nichtweitergabe Ihrer Daten haben,
          </li>
          <li>fur den Fall, dass fur die Weitergabe nach Art. 6 Abs. 1 S. 1 lit. c EuDSGVO eine gesetzliche Verpflichtung besteht, sowie</li>
          <li>
            dies gesetzlich zulassig und nach Art. 6 Abs. 1 S. 1 lit. b EuDSGVO fur die Abwicklung von
            Vertragsverhaltnissen mit Ihnen erforderlich ist.
          </li>
        </ul>
      </section>

      <section className="mb-4">
        <h2 className="h5">8. Kontaktformular</h2>
        <p>
          Bei Fragen jeglicher Art bieten wir Ihnen die Moglichkeit, mit uns uber ein auf der Website bereitgestelltes
          Formular Kontakt aufzunehmen. Dabei sind Angaben erforderlich, damit wir wissen, von wem die Anfrage stammt
          und um diese beantworten zu konnen. Weitere Angaben konnen zwecks Bearbeitung der Anfrage freiwillig getatigt
          werden. Die Datenverarbeitung zum Zwecke der Kontaktaufnahme mit uns erfolgt nach Art. 6 Abs. 1 S. 1 lit. a
          EuDSGVO auf Grundlage Ihrer freiwillig erteilten Einwilligung. Die fur die Benutzung des Kontaktformulars von
          uns erhobenen personenbezogenen Daten werden nach Erledigung der von Ihnen gestellten Anfrage automatisch
          geloscht.
        </p>
      </section>

      <section className="mb-4">
        <h2 className="h5">9. Betroffenenrechte</h2>
        <p>Sie haben das Recht:</p>
        <ul>
          <li>
            gemaß Art. 15 EuDSGVO Auskunft uber Ihre von uns verarbeiteten personenbezogenen Daten zu verlangen.
          </li>
          <li>
            gemaß Art. 16 EuDSGVO unverzuglich die Berichtigung unrichtiger oder Vervollstandigung Ihrer bei uns
            gespeicherten personenbezogenen Daten zu verlangen.
          </li>
          <li>
            gemaß Art. 17 EuDSGVO die Loschung Ihrer bei uns gespeicherten personenbezogenen Daten zu verlangen, soweit
            nicht rechtliche Ausnahmen greifen.
          </li>
          <li>
            gemaß Art. 18 EuDSGVO die Einschrankung der Verarbeitung Ihrer personenbezogenen Daten zu verlangen.
          </li>
          <li>
            gemaß Art. 20 EuDSGVO Ihre personenbezogenen Daten in einem strukturierten, gangigen und maschinenlesebaren
            Format zu erhalten oder die Ubermittlung an einen anderen Verantwortlichen zu verlangen.
          </li>
          <li>
            gemaß Art. 7 Abs. 3 EuDSGVO Ihre einmal erteilte Einwilligung jederzeit gegenuber uns zu widerrufen.
          </li>
          <li>
            gemaß Art. 77 EuDSGVO sich bei einer Aufsichtsbehorde zu beschweren.
          </li>
        </ul>
      </section>

      <section className="mb-4">
        <h2 className="h5">10. Widerspruchsrecht</h2>
        <p>
          Sofern Ihre personenbezogenen Daten auf Grundlage von berechtigten Interessen gemaß Art. 6 Abs. 1 S. 1 lit. f
          EuDSGVO verarbeitet werden, haben Sie das Recht, gemaß Art. 21 EuDSGVO Widerspruch gegen die Verarbeitung
          Ihrer personenbezogenen Daten einzulegen, soweit dafur Grunde vorliegen, die sich aus Ihrer besonderen
          Situation ergeben oder sich der Widerspruch gegen Direktwerbung richtet. Im letzteren Fall haben Sie ein
          generelles Widerspruchsrecht, das ohne Angabe einer besonderen Situation von uns umgesetzt wird.
        </p>
        <p>
          Mochten Sie von Ihrem Widerrufs- oder Widerspruchsrecht Gebrauch machen, genugt eine E-Mail an
          info[at]wohnlagencheck24[dot]de.
        </p>
      </section>

      <section className="mb-4">
        <h2 className="h5">11. Datensicherheit</h2>
        <p>
          Wir verwenden innerhalb des Website-Besuchs das verbreitete SSL-Verfahren (Secure Socket Layer) in Verbindung
          mit der jeweils hochsten Verschlusselungsstufe, die von Ihrem Browser unterstutzt wird. In der Regel handelt
          es sich dabei um eine 256 Bit Verschlusselung. Falls Ihr Browser keine 256-Bit Verschlusselung unterstutzt,
          greifen wir stattdessen auf 128-Bit v3 Technologie zuruck. Ob eine einzelne Seite unseres Internetauftrittes
          verschlusselt ubertragen wird, erkennen Sie an der geschlossenen Darstellung des Schlussel- beziehungsweise
          Schloss-Symbols in der unteren Statusleiste Ihres Browsers.
        </p>
        <p>
          Wir bedienen uns im Ubrigen geeigneter technischer und organisatorischer Sicherheitsmaßnahmen, um Ihre Daten
          gegen zufallige oder vorsatzliche Manipulationen, teilweisen oder vollstandigen Verlust, Zerstorung oder
          gegen den unbefugten Zugriff Dritter zu schutzen. Unsere Sicherheitsmaßnahmen werden entsprechend der
          technologischen Entwicklung fortlaufend verbessert.
        </p>
      </section>

      <section>
        <h2 className="h5">12. Schlusserklarung</h2>
        <p>
          Durch die Weiterentwicklung unserer Website und Angebote daruber oder aufgrund geanderter gesetzlicher
          beziehungsweise behordlicher Vorgaben kann es notwendig werden, diese Datenschutzerklarung zu andern. Die
          jeweils aktuelle Datenschutzerklarung kann jederzeit auf der Website unter
          https://www.wohnlagencheck24.de/datenschutz.html von Ihnen abgerufen und ausgedruckt werden.
        </p>
      </section>
    </div>
  );
}
