Hier nochmal ein kurzer Abriss zur Funktionalität im Partnerbackend von wohnlagencheck24, damit wir die gleiche Basis haben wenn wir die Portalfunktionen mit Supabase umsetzen.

Partner, Partnergebiete
########################

Grundsätzlich kann ein Partner mehrere Kreise mit den jeweiligen Ortslagen haben in denen er preisdaten faktorsieren oder seine Texte individualisieren kann. hier findet die zuordnung Partner -> Kreis(e) statt

CREATE TABLE public.partners (
  id uuid NOT NULL DEFAULT auth.uid(),
  company_name text NOT NULL,
  contact_person text,
  website_url text,
  created_at timestamp with time zone DEFAULT now(),
  contact_email text,
  CONSTRAINT partners_pkey PRIMARY KEY (id)
);

CREATE TABLE public.areas (
  id text NOT NULL,
  name text NOT NULL,
  type text,
  parent_id text,
  CONSTRAINT areas_pkey PRIMARY KEY (id)
);



Texte
######

Aktuell ist es generell (und auch im Partnerbereich) so organisiert, dass es 3 Texttypen gibt, 

-datadriven, 
-- datadriven Text wird regelmäßig aus den Daten generiert und aktualisiert, wobei sich hier gerade die Texte mit Preisdaten mind. 1 mal monatl ändern
-- aufgrund der hohen Aktualisierungszyklen macht es hier wenig Sinn die Texte immer mit viel Aufwand neu zu individualisieren

-individual,
-- individual Text (individuelle vom Partner gelieferte Texte) soll mind. einmal im Quartal vom Partner aktualisiert werden. hier gibt er eine persönliche Markteinschätzung, das wird der USP des Portals

-general 
-- general Text (allgemeine Einleitungstexte und Erklärtexte) wird einmal von uns individualisiert, um zwischen den Gebieten schonmal uniquen text auszuliefern.   



die Textdaten werden im python generiert und werden dann in die jonstruktur geschrieben, die sich  mit der supabase datenbank abgleichen sollte. next.js holt die texte ins partnerbackend und auch frontend. Im Partnerbackend können sie mit hilfe von ki Werkzeugen individualisiert. hier müssen wir beachten dass sich datendriven texte nach aktualisierung von daten im kontext ändern können. Getätigte individualisierungen haben also nicht lange bestand - was kann man da machen bzw. kannst du prüfen ob dort mögliche Automatisierung verbaut wurde.


CREATE TABLE public.report_texts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL,
  area_id text NOT NULL,
  section_key text NOT NULL,
  text_type USER-DEFINED NOT NULL,
  raw_content text,
  optimized_content text,
  status text DEFAULT 'approved'::text,
  last_updated timestamp with time zone DEFAULT now(),
  CONSTRAINT report_texts_pkey PRIMARY KEY (id),
  CONSTRAINT report_texts_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id),
  CONSTRAINT report_texts_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id)
);



Preis-Faktorisierung
####################

im Dashboard gibt es bereits eine oberfläche in der partner in seinen gebiet/en vom Kreis bis in die ortslagen preise global faktorisieren kann aber auch jede Ortslage. tätigt er diese eingaberegler muss er die einstellungen in supabase

CREATE TABLE public.partner_area_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  partner_id uuid,
  area_id text,
  price_factor_houses double precision DEFAULT 1.0,
  price_factor_apartments double precision DEFAULT 1.0,
  custom_intro_text text,
  custom_market_report text,
  is_active boolean DEFAULT true,
  last_update timestamp with time zone DEFAULT now(),
  standortfaktoren jsonb DEFAULT '{"bildung": 1, "gesundheit": 1, "mobilitaet": 1, "naherholung": 1, "arbeitsplatz": 1, "nahversorgung": 1, "lebenserhaltungskosten": 1}'::jsonb,
  immobilienmarkt_trend jsonb DEFAULT '{"mietmarkt": 1, "immobilienmarkt": 1}'::jsonb,
  kauf_haus jsonb DEFAULT '{"f01": 1, "f02": 1, "f03": 1, "f04": 1, "f05": 1, "f06": 1}'::jsonb,
  kauf_wohnung jsonb DEFAULT '{"f01": 1, "f02": 1, "f03": 1, "f04": 1, "f05": 1, "f06": 1}'::jsonb,
  kauf_grundstueck jsonb DEFAULT '{"f01": 1, "f02": 1, "f03": 1, "f04": 1, "f05": 1, "f06": 1}'::jsonb,
  miete_haus jsonb DEFAULT '{"f01": 1, "f02": 1, "f03": 1, "f04": 1, "f05": 1, "f06": 1}'::jsonb,
  miete_wohnung jsonb DEFAULT '{"f01": 1, "f02": 1, "f03": 1, "f04": 1, "f05": 1, "f06": 1}'::jsonb,
  rendite jsonb DEFAULT '{"mietrendite_efh": 1, "mietrendite_etw": 1, "mietrendite_mfh": 1, "kaufpreisfaktor_efh": 1, "kaufpreisfaktor_etw": 1, "kaufpreisfaktor_mfh": 1}'::jsonb,
  CONSTRAINT partner_area_config_pkey PRIMARY KEY (id),
  CONSTRAINT partner_area_config_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id),
  CONSTRAINT partner_area_config_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id)
);


python prüft bei jedem berechnungsdurhlauf ob es faktorisierungen gab und wenn ja läd er die jeweiligen faktoren aus supabase und rechnet damit. die aktualisierten daten und die daraus neu generierten datadriven Texte werden dann wie der iun die json geschrieben und mit supabase abgeglichen, um sie dam im dashboard des Partners aktualisiert anzuzeigen und wenn gewünscht manuelle oder KIIndividualisierung vorzunehmen.

