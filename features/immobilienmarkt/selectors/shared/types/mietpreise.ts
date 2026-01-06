export type MietpreiseVM = {
  level: "kreis" | "ort";
  regionName: string;
  bundeslandName?: string;
  basePath: string;

  teaser: string;

  berater: {
    name: string;
    telefon: string;
    email: string;
    taetigkeit: string;
    imageSrc: string;
  };

  hero: {
    imageSrc: string;
    title: string;
    subtitle: string;
  };

  kpis: {
    kaltmiete: number | null;
    nebenkosten: number | null;
    warmmiete: number | null;
  };
};
