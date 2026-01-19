// features/immobilienmarkt/selectors/shared/types/wohnlagencheck.ts

export type WohnlagencheckGalleryImage = {
  src: string;
  alt: string;
};

export type WohnlagencheckTheme =
  | "mobilitaet"
  | "bildung"
  | "gesundheit"
  | "naherholung"
  | "nahversorgung"
  | "kultur_freizeit";

export type WohnlagencheckPoiImage = {
  src: string;
  alt: string;
};

export type WohnlagencheckIndex = {
  value: number | null;
  color?: string;
};

type WohnlagencheckFaktorBase = {
  theme: WohnlagencheckTheme;
  title: string;
  text: string;
  index: WohnlagencheckIndex;
};

export type WohnlagencheckMobilitaet = WohnlagencheckFaktorBase & {
  theme: "mobilitaet";
  fernanbindung: {
    autobahn?: string;
    flughafen?: string;
    bahnhof?: string;
  };
  oepnvLinien?: string;
  values: {
    autobahnCount?: number | null;
    autobahnDistance?: number | null;
    flughafenCount?: number | null;
    flughafenDistance?: number | null;
    bahnhofCount?: number | null;
    bahnhofDistance?: number | null;
    tankstellen?: number | null;
    autogas?: number | null;
    eladesaeulen?: number | null;
    ticketpreis?: number | null;
    oepnvErreichbarkeit?: number | null;
    linienDichte?: number | null;
  };
  maps: {
    autobahn?: WohnlagencheckPoiImage;
    flughafen?: WohnlagencheckPoiImage;
    bahnhof?: WohnlagencheckPoiImage;
    oepnv?: WohnlagencheckPoiImage;
  };
  verkehrsflaechenanteil: Array<{ label: string; value: number | null }>;
  verkehrsflaechenanteilRegionLabel?: string;
};

export type WohnlagencheckBildung = WohnlagencheckFaktorBase & {
  theme: "bildung";
  values: {
    kitas?: number | null;
    fachpersonal?: number | null;
    integrativ?: number | null;
    kitaErreichbarkeit?: number | null;
    grundschuleErreichbarkeit?: number | null;
    allgemeinbildendeSchulen?: number | null;
    gymnasiumErreichbarkeit?: number | null;
    ohneAbschluss?: number | null;
    hochschulreife?: number | null;
    foerderschulen?: number | null;
    hochschulen?: number | null;
    internationalisierung?: number | null;
    studenten?: number | null;
  };
  maps: {
    kita?: WohnlagencheckPoiImage;
    grundschule?: WohnlagencheckPoiImage;
    gymnasium?: WohnlagencheckPoiImage;
  };
  absolventenverteilung: Array<{ label: string; value: number | null }>;
  absolventenverteilungRegionLabel?: string;
};

export type WohnlagencheckGesundheit = WohnlagencheckFaktorBase & {
  theme: "gesundheit";
  values: {
    arzt?: number | null;
    zahnarzt?: number | null;
    apotheke?: number | null;
    kliniken?: number | null;
    klinikenErreichbarkeit?: number | null;
    reha?: number | null;
    pflegeStationaer?: number | null;
    pflegeAmbulant?: number | null;
    bettenKliniken?: number | null;
    bettenReha?: number | null;
    plaetzePflege?: number | null;
  };
  maps: {
    arzt?: WohnlagencheckPoiImage;
    zahnarzt?: WohnlagencheckPoiImage;
    apotheke?: WohnlagencheckPoiImage;
    kliniken?: WohnlagencheckPoiImage;
  };
};

export type WohnlagencheckNaherholung = WohnlagencheckFaktorBase & {
  theme: "naherholung";
  values: {
    wald?: number | null;
    wasser?: number | null;
    parkanteil?: number | null;
    parkErreichbarkeit?: number | null;
    parkBereitstellung?: number | null;
    naturschutz?: number | null;
    luftqualitaet?: number | null;
    landschaftqualitaet?: number | null;
  };
  maps: {
    parks?: WohnlagencheckPoiImage;
  };
  vegetationsflaechenanteil: Array<{ label: string; value: number | null }>;
  vegetationsflaechenanteilRegionLabel?: string;
};

export type WohnlagencheckNahversorgung = WohnlagencheckFaktorBase & {
  theme: "nahversorgung";
  values: {
    supermarktVersorgung?: number | null;
    supermarktErreichbarkeit?: number | null;
  };
  maps: {
    supermaerkte?: WohnlagencheckPoiImage;
  };
};

export type WohnlagencheckKulturFreizeit = WohnlagencheckFaktorBase & {
  theme: "kultur_freizeit";
  values: {
    museum?: number | null;
    theater?: number | null;
    kino?: number | null;
    kulturErreichbarkeit?: number | null;
    sportanlagen?: number | null;
    spielplaetze?: number | null;
    schwimmbaeder?: number | null;
    essenTrinken?: number | null;
    nightlife?: number | null;
  };
  maps: {
    kultur?: WohnlagencheckPoiImage;
    sport?: WohnlagencheckPoiImage;
    spielplaetze?: WohnlagencheckPoiImage;
    schwimmbaeder?: WohnlagencheckPoiImage;
    essenTrinken?: WohnlagencheckPoiImage;
    nightlife?: WohnlagencheckPoiImage;
  };
};

export type WohnlagencheckFaktor =
  | WohnlagencheckMobilitaet
  | WohnlagencheckBildung
  | WohnlagencheckGesundheit
  | WohnlagencheckNaherholung
  | WohnlagencheckNahversorgung
  | WohnlagencheckKulturFreizeit;

export type WohnlagencheckVM = {
  level: "kreis" | "ort";
  regionName: string;
  kreisName?: string;
  bundeslandName?: string;
  basePath: string;
  updatedAt?: string;

  headlineMain: string;
  headlineAllgemein: string;
  headlineAllgemeinIndividuell?: string;

  textAllgemein: string;
  textLage: string;

  flaecheGesamt: number | null;
  flaechenverteilung: Array<{ label: string; value: number | null }>;
  siedlungsflaechenverteilung: Array<{ label: string; value: number | null }>;
  quellenangabeGebiete?: string;

  headlineFaktoren: string;
  headlineFaktorenIndividuell?: string;
  standortfaktorenIntro: string;
  radarPoints: Array<{ label: string; value: number }>;

  hero: {
    title: string;
    subtitle: string;
    imageSrc: string;
  };

  berater: {
    name: string;
    taetigkeit: string;
    imageSrc: string;
  };

  gallery: WohnlagencheckGalleryImage[];

  faktoren: WohnlagencheckFaktor[];
};
